import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { processClassFeeGeneration } from "@/lib/services/fee-generation-service";
import { invalidateFeesCache } from "@/lib/redis";
import { formatPeriodLabel } from "@/lib/fees/billing-period";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import crypto from "crypto";

const cronLogger = createLogger("cron-generate-fees");

// Prevents this route from being statically compiled, ensuring it runs on request
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      cronLogger.error("CRON_SECRET is not configured. Failing closed.");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const authHeader = request.headers.get("authorization");
    const expectedHeader = `Bearer ${cronSecret}`;
    if (
      !authHeader ||
      authHeader.length !== expectedHeader.length ||
      !crypto.timingSafeEqual(
        Buffer.from(authHeader),
        Buffer.from(expectedHeader),
      )
    ) {
      cronLogger.warn({ authHeader }, "Unauthorized cron access attempt");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get all active schools with autoFeeGeneration enabled
    const schools = await prisma.school.findMany({
      where: { isActive: true, autoFeeGeneration: true },
      select: { id: true, name: true, timezone: true },
    });

    let totalGenerated = 0;
    const results = [];
    const now = new Date();

    for (const school of schools) {
      // The billing month is the current month in the school's own time zone;
      // the charge is due on the 10th of it.
      const periodKey = calendarDateInTimeZone(
        resolveTimeZone(school.timezone),
        now,
      ).slice(0, 7);
      const [year, month] = periodKey.split("-").map(Number);
      const title = formatPeriodLabel(periodKey);
      const dueDate = new Date(Date.UTC(year, month - 1, 10));

      // Find the current active session for the school
      const currentSession = await prisma.academicSession.findFirst({
        where: { schoolId: school.id, isCurrent: true },
      });

      if (!currentSession) {
        results.push({ school: school.name, error: "No active session found" });
        continue;
      }

      const classes = await prisma.class.findMany({
        where: { schoolId: school.id },
        select: { id: true, name: true },
      });

      let schoolGeneratedCount = 0;
      const classErrors: { className: string; error: string }[] = [];

      for (const cls of classes) {
        const res = await processClassFeeGeneration(
          school.id,
          currentSession.id,
          cls.id,
          { periodKey, title, dueDate },
        );

        if (res.error) {
          classErrors.push({ className: cls.name, error: res.error });
        } else if (res.generatedCount) {
          schoolGeneratedCount += res.generatedCount;
          totalGenerated += res.generatedCount;
        }
      }

      if (schoolGeneratedCount > 0) {
        await invalidateFeesCache(school.id);
      }

      results.push({
        school: school.name,
        month: periodKey,
        generated: schoolGeneratedCount,
        ...(classErrors.length > 0 ? { classErrors } : {}),
      });
    }

    const durationMs = Math.round(performance.now() - start);
    cronLogger.info(
      {
        schoolsCount: schools.length,
        totalChargesGenerated: totalGenerated,
        durationMs,
      },
      `[Cron Fee Generation Completed] Generated ${totalGenerated} charges across ${schools.length} schools in ${durationMs}ms`,
    );

    return NextResponse.json({
      success: true,
      totalChargesGenerated: totalGenerated,
      details: results,
      durationMs,
    });
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - start);
    cronLogger.error(
      { err: error, durationMs },
      `[Cron Fee Generation Failed]: ${error?.message || error}`,
    );

    Sentry.captureException(error, {
      tags: { job: "cron-generate-fees" },
    });

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
