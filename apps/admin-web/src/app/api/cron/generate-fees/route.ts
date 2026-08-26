import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { processClassFeeGeneration } from "@/lib/actions/fee-generator";
import { invalidateFeesCache } from "@/lib/redis";

const cronLogger = createLogger("cron-generate-fees");

// Prevents this route from being statically compiled, ensuring it runs on request
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const authHeader = request.headers.get("authorization");

    // Verify the secret if configured
    if (process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        cronLogger.warn({ authHeader }, "Unauthorized cron access attempt");
        return new NextResponse("Unauthorized", { status: 401 });
      }
    } else {
      cronLogger.warn("CRON_SECRET is not set in environment variables. This route is unprotected.");
    }

    // Get all active schools
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let totalGenerated = 0;
    const results = [];

    // Calculate current month strings (e.g. "October 2026")
    const now = new Date();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthTitle = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    // Default due date to the 10th of the current month
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);

    for (const school of schools) {
      // Find the current active session for the school
      const currentSession = await prisma.academicSession.findFirst({
        where: { schoolId: school.id, isCurrent: true },
      });

      if (!currentSession) {
        results.push({ school: school.name, error: "No active session found" });
        continue;
      }

      // Get all active classes
      const classes = await prisma.class.findMany({
        where: { schoolId: school.id },
      });

      let schoolGeneratedCount = 0;

      for (const cls of classes) {
        const res = await processClassFeeGeneration(
          school.id,
          currentSession.id,
          cls.id,
          monthTitle,
          dueDate
        );

        if (res.success && res.generatedCount) {
          schoolGeneratedCount += res.generatedCount;
          totalGenerated += res.generatedCount;
        }
      }

      if (schoolGeneratedCount > 0) {
        await invalidateFeesCache(school.id);
      }

      results.push({ school: school.name, generated: schoolGeneratedCount });
    }

    const durationMs = Math.round(performance.now() - start);
    cronLogger.info(
      {
        month: monthTitle,
        schoolsCount: schools.length,
        totalChargesGenerated: totalGenerated,
        durationMs,
      },
      `[Cron Fee Generation Completed] Generated ${totalGenerated} charges across ${schools.length} schools in ${durationMs}ms`
    );

    return NextResponse.json({
      success: true,
      month: monthTitle,
      totalChargesGenerated: totalGenerated,
      details: results,
      durationMs,
    });
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - start);
    cronLogger.error(
      { err: error, durationMs },
      `[Cron Fee Generation Failed]: ${error?.message || error}`
    );

    Sentry.captureException(error, {
      tags: { job: "cron-generate-fees" },
    });

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
