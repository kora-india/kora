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

    // Find all schools that have late fees enabled
    const schools = await prisma.school.findMany({
      where: { lateFeeEnabled: true, lateFeeAmount: { not: null } },
      select: { id: true, lateFeeAmount: true, lateFeeFrequency: true },
    });

    let appliedCount = 0;

    for (const school of schools) {
      if (!school.lateFeeAmount) continue;

      // Get the Late Fee component for this school
      const lateFeeComponent = await prisma.feeComponent.findFirst({
        where: { schoolId: school.id, category: "LATE_FEE" },
      });

      if (!lateFeeComponent) continue;

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
        // Determine how many months overdue
        const monthsOverdue = differenceInMonths(today, charge.dueDate);

        if (monthsOverdue > 0) {
          const totalLateFee = Number(school.lateFeeAmount) * monthsOverdue;

          // Check if there's already a late fee item
          const existingLateFeeItem = charge.items.find(
            (i) => i.componentId === lateFeeComponent.id
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
