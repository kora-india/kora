import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { invalidateFeesCache } from "@/lib/redis";
import { logActivity, SYSTEM_ACTOR } from "@/lib/activity";
import { todayInTimeZone } from "@/lib/fees/timezone";
import { calculateLateFee } from "@/lib/fees/late-fee";
import crypto from "crypto";

const cronLogger = createLogger("cron-apply-late-fees");

// Prevents this route from being statically compiled, ensuring it runs on request
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const start = performance.now();
  // 1. Verify cron secret to prevent unauthorized execution (fail closed)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    cronLogger.error("CRON_SECRET is not configured. Failing closed.");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const authHeader = req.headers.get("authorization");
  const expectedHeader = `Bearer ${cronSecret}`;
  if (
    !authHeader ||
    authHeader.length !== expectedHeader.length ||
    !crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expectedHeader),
    )
  ) {
    cronLogger.warn(
      { authHeader },
      "Unauthorized late-fee cron access attempt",
    );
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Active schools only; a suspended school's dues are frozen.
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      select: {
        id: true,
        timezone: true,
        lateFeeEnabled: true,
        lateFeeAmount: true,
        lateFeeFrequency: true,
        maxLateFeeCap: true,
      },
    });

    let appliedCount = 0;

    for (const school of schools) {
      // "Overdue" starts at midnight in the school's own time zone.
      const today = todayInTimeZone(school.timezone);

      // 1. Charges and items past their due date become OVERDUE (active students only)
      await prisma.feeCharge.updateMany({
        where: {
          schoolId: school.id,
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { lt: today },
          student: { isActive: true },
        },
        data: { status: "OVERDUE" },
      });

      await prisma.feeChargeItem.updateMany({
        where: {
          status: "PENDING",
          charge: {
            schoolId: school.id,
            dueDate: { lt: today },
            student: { isActive: true },
          },
        },
        data: { status: "OVERDUE" },
      });

      // 2. Late fees, for schools that charge them
      if (!school.lateFeeEnabled || !school.lateFeeAmount) continue;

      let lateFeeComponent = await prisma.feeComponent.findFirst({
        where: { schoolId: school.id, category: "LATE_FEE" },
      });

      if (!lateFeeComponent) {
        lateFeeComponent = await prisma.feeComponent.create({
          data: {
            schoolId: school.id,
            name: "Late Fee",
            description: "Automated penalty for overdue payment",
            category: "LATE_FEE",
            amount: school.lateFeeAmount,
            frequency: "MONTHLY",
            isOptional: true,
            isActive: true,
          },
        });
      }

      // B13: Find all overdue FeeCharges for active students only. Imported
      // bills stay as the school's records have them, unless the school
      // chose to keep late fees running on a history import.
      const finedImports = await prisma.feeImport.findMany({
        where: {
          schoolId: school.id,
          continueLateFees: true,
          undoneAt: null,
        },
        select: { id: true },
      });
      const overdueCharges = await prisma.feeCharge.findMany({
        where: {
          schoolId: school.id,
          status: "OVERDUE",
          dueDate: { lt: today },
          student: { isActive: true },
          OR: [
            { importId: null },
            { importId: { in: finedImports.map((i) => i.id) } },
          ],
        },
        include: { items: true },
      });

      let schoolFeeUpdated = false;
      const appliedBefore = appliedCount;

      for (const charge of overdueCharges) {
        // Calculate days overdue
        const diffMs = today.getTime() - new Date(charge.dueDate).getTime();
        const daysOverdue = Math.max(
          0,
          Math.floor(diffMs / (1000 * 60 * 60 * 24)),
        );

        if (daysOverdue > 0) {
          const chargePrincipal = charge.items
            .filter((i) => i.componentId !== lateFeeComponent!.id)
            .reduce((s, it) => s + Number(it.amount), 0);
          const totalLateFee = calculateLateFee(
            {
              lateFeeAmount: Number(school.lateFeeAmount),
              lateFeeFrequency: school.lateFeeFrequency,
              maxLateFeeCap: school.maxLateFeeCap
                ? Number(school.maxLateFeeCap)
                : null,
            },
            daysOverdue,
            chargePrincipal,
          );

          // Check if there's already a late fee item
          const existingLateFeeItem = charge.items.find(
            (i) => i.componentId === lateFeeComponent!.id,
          );

          if (existingLateFeeItem) {
            // Update if amount has increased
            if (
              Number(existingLateFeeItem.amount) < totalLateFee &&
              existingLateFeeItem.status !== "WAIVED" &&
              existingLateFeeItem.status !== "PAID"
            ) {
              await prisma.feeChargeItem.update({
                where: { id: existingLateFeeItem.id },
                data: { amount: totalLateFee },
              });
              appliedCount++;
              schoolFeeUpdated = true;
            }
          } else {
            // Create a new late fee item for this charge
            await prisma.feeChargeItem.create({
              data: {
                chargeId: charge.id,
                componentId: lateFeeComponent.id,
                amount: totalLateFee,
                status: "PENDING",
              },
            });
            appliedCount++;
            schoolFeeUpdated = true;
          }
        }
      }

      if (schoolFeeUpdated) {
        await invalidateFeesCache(school.id);
        const applied = appliedCount - appliedBefore;
        await logActivity(SYSTEM_ACTOR, {
          schoolId: school.id,
          action: "fee.late_fee",
          module: "fees",
          summary: `Added or raised late fees on ${applied} overdue bill${applied === 1 ? "" : "s"}`,
        });
      }
    }

    const durationMs = Math.round(performance.now() - start);
    cronLogger.info(
      {
        schoolsProcessed: schools.length,
        recordsUpdated: appliedCount,
        durationMs,
      },
      `[Late Fee Cron Completed] Processed ${schools.length} schools, applied/updated ${appliedCount} records in ${durationMs}ms`,
    );

    return NextResponse.json({
      success: true,
      message: `Applied/Updated late fees for ${appliedCount} records.`,
      durationMs,
    });
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - start);
    cronLogger.error(
      { err: error, durationMs },
      `[Late Fee Cron Failed]: ${error?.message || error}`,
    );

    Sentry.captureException(error, {
      tags: { job: "cron-apply-late-fees" },
    });

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
