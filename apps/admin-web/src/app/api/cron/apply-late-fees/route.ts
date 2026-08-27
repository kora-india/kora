import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { differenceInMonths } from "date-fns";
import { invalidateFeesCache } from "@/lib/redis";

const cronLogger = createLogger("cron-apply-late-fees");

// This route should be triggered daily by Vercel Cron or a scheduler
// URL: /api/cron/apply-late-fees
export async function GET(req: Request) {
  const start = performance.now();
  // 1. Verify cron secret to prevent unauthorized execution (Vercel best practice)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    cronLogger.warn({ authHeader }, "Unauthorized late-fee cron access attempt");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Automatically transition charges and items past due date to OVERDUE
    await prisma.feeCharge.updateMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { lt: today },
      },
      data: {
        status: "OVERDUE",
      },
    });

    await prisma.feeChargeItem.updateMany({
      where: {
        status: "PENDING",
        charge: {
          dueDate: { lt: today },
        },
      },
      data: {
        status: "OVERDUE",
      },
    });

    // 2. Find all schools that have late fees enabled
    const schools = await prisma.school.findMany({
      where: { lateFeeEnabled: true, lateFeeAmount: { not: null } },
      select: { id: true, lateFeeAmount: true, lateFeeFrequency: true },
    });

    let appliedCount = 0;

    for (const school of schools) {
      if (!school.lateFeeAmount) continue;

      // Get or create the Late Fee component for this school
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

      // Find all overdue FeeCharges for this school
      const overdueCharges = await prisma.feeCharge.findMany({
        where: {
          schoolId: school.id,
          status: "OVERDUE",
          dueDate: { lt: today },
        },
        include: { items: true },
      });

      let schoolFeeUpdated = false;

      for (const charge of overdueCharges) {
        // Calculate days overdue
        const diffMs = today.getTime() - new Date(charge.dueDate).getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        if (daysOverdue > 0) {
          let multiplier = 1;
          if (school.lateFeeFrequency === "DAILY") {
            multiplier = daysOverdue;
          } else if (school.lateFeeFrequency === "WEEKLY") {
            multiplier = Math.ceil(daysOverdue / 7);
          } else {
            // MONTHLY default
            multiplier = Math.max(1, Math.ceil(daysOverdue / 30));
          }

          const totalLateFee = Number(school.lateFeeAmount) * multiplier;

          // Check if there's already a late fee item
          const existingLateFeeItem = charge.items.find(
            (i) => i.componentId === lateFeeComponent!.id
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
      }
    }

    const durationMs = Math.round(performance.now() - start);
    cronLogger.info(
      {
        schoolsProcessed: schools.length,
        recordsUpdated: appliedCount,
        durationMs,
      },
      `[Late Fee Cron Completed] Processed ${schools.length} schools, applied/updated ${appliedCount} records in ${durationMs}ms`
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
      `[Late Fee Cron Failed]: ${error?.message || error}`
    );

    Sentry.captureException(error, {
      tags: { job: "cron-apply-late-fees" },
    });

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
