import { NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma, Prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { processClassFeeGeneration } from "@/lib/services/fee-generation-service";
import { invalidateFeesCache } from "@/lib/redis";
import { formatPeriodLabel } from "@/lib/fees/billing-period";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import crypto from "crypto";

const cronLogger = createLogger("cron-generate-fees");

// Prevents this route from being statically compiled, ensuring it runs on request
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Work stops after this long so the hand-off below fits in `maxDuration`. */
const TIME_BUDGET_MS = 40_000;
/** How long to wait for the next run to start before letting go of it. */
const HANDOFF_TIMEOUT_MS = 10_000;
/** A chain of runs stops here; the next day's scheduled run picks up the rest. */
const MAX_HOPS = 30;

/**
 * Monthly fee generation (P6).
 *
 * Each school records the billing month it was last fully billed for
 * (`lastAutoFeePeriod`), so a run only looks at schools still to do. When the
 * time budget runs out, or there are more schools than one batch, the run
 * starts the next one itself, continuing after the last school it finished.
 * The schedule also repeats on days 2–5 of the month to catch anything a chain
 * left behind. Generation is idempotent per student and month, so a school
 * cut off half-way is simply processed again.
 *
 * `?schoolId=` bills one school right away, even if it is marked done.
 */
export async function GET(request: Request) {
  const start = performance.now();
  const elapsed = () => performance.now() - start;
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
      cronLogger.warn(
        { hasAuthHeader: Boolean(authHeader) },
        "Unauthorized cron access attempt",
      );
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const targetSchoolId = url.searchParams.get("schoolId");
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "25", 10) || 25, 1),
      50,
    );
    const hop = Math.max(
      parseInt(url.searchParams.get("hop") || "0", 10) || 0,
      0,
    );

    const now = new Date();
    // The latest month any school can be in right now (UTC+14). A school
    // already billed for it is done; the rest are checked against their own
    // month below, since a school west of UTC may still be in last month.
    const latestPeriod = calendarDateInTimeZone(
      "Pacific/Kiritimati",
      now,
    ).slice(0, 7);

    const where: Prisma.SchoolWhereInput = targetSchoolId
      ? { id: targetSchoolId, isActive: true, autoFeeGeneration: true }
      : {
          isActive: true,
          autoFeeGeneration: true,
          OR: [
            { lastAutoFeePeriod: null },
            { lastAutoFeePeriod: { lt: latestPeriod } },
          ],
          ...(cursor ? { id: { gt: cursor } } : {}),
        };

    const schools = await prisma.school.findMany({
      where,
      select: { id: true, name: true, timezone: true, lastAutoFeePeriod: true },
      orderBy: { id: "asc" },
      take: targetSchoolId ? 1 : limit,
    });

    let totalGenerated = 0;
    const results = [];
    // The next run continues after this school; null starts from the first.
    let resumeAfter: string | null = cursor;
    let outOfTime = false;

    for (const school of schools) {
      if (!targetSchoolId && elapsed() > TIME_BUDGET_MS) {
        outOfTime = true;
        break;
      }

      // The billing month is the current month in the school's own time zone;
      // the charge is due on the 10th of it.
      const periodKey = calendarDateInTimeZone(
        resolveTimeZone(school.timezone),
        now,
      ).slice(0, 7);

      if (
        !targetSchoolId &&
        school.lastAutoFeePeriod &&
        school.lastAutoFeePeriod >= periodKey
      ) {
        resumeAfter = school.id;
        continue;
      }

      const [year, month] = periodKey.split("-").map(Number);
      const title = formatPeriodLabel(periodKey);
      const dueDate = new Date(Date.UTC(year, month - 1, 10));

      // Find the current active session for the school
      const currentSession = await prisma.academicSession.findFirst({
        where: { schoolId: school.id, isCurrent: true },
      });

      if (!currentSession) {
        // Not marked done: a session added later this week still gets billed.
        results.push({ school: school.name, error: "No active session found" });
        resumeAfter = school.id;
        continue;
      }

      const classes = await prisma.class.findMany({
        where: { schoolId: school.id },
        select: { id: true, name: true },
      });

      let schoolGeneratedCount = 0;
      const classErrors: {
        className: string;
        error: string;
        retryable?: boolean;
      }[] = [];

      for (const cls of classes) {
        if (!targetSchoolId && elapsed() > TIME_BUDGET_MS) {
          outOfTime = true;
          break;
        }
        const res = await processClassFeeGeneration(
          school.id,
          currentSession.id,
          cls.id,
          { periodKey, title, dueDate },
        );

        if (res.error) {
          classErrors.push({
            className: cls.name,
            error: res.error,
            ...("retryable" in res && res.retryable ? { retryable: true } : {}),
          });
        } else if (res.generatedCount) {
          schoolGeneratedCount += res.generatedCount;
          totalGenerated += res.generatedCount;
        }
      }

      if (schoolGeneratedCount > 0) {
        await invalidateFeesCache(school.id);
      }

      // Classes with nothing to bill (no students, no fee structure) don't
      // hold the school back; a crash or a clash with another run does.
      const complete = !outOfTime && !classErrors.some((e) => e.retryable);
      if (complete) {
        await prisma.school.update({
          where: { id: school.id },
          data: { lastAutoFeePeriod: periodKey },
        });
      }

      results.push({
        school: school.name,
        month: periodKey,
        generated: schoolGeneratedCount,
        complete,
        ...(classErrors.length > 0 ? { classErrors } : {}),
      });

      // A school cut off part-way is done again by the next run.
      if (outOfTime) break;
      resumeAfter = school.id;
    }

    const resumable =
      !targetSchoolId && (outOfTime || schools.length === limit);
    const nextCursor = resumable ? resumeAfter : null;

    let continued = false;
    if (resumable && hop < MAX_HOPS) {
      const next = new URL(url.pathname, url.origin);
      if (nextCursor) next.searchParams.set("cursor", nextCursor);
      next.searchParams.set("limit", String(limit));
      next.searchParams.set("hop", String(hop + 1));
      after(() => handOff(next, authHeader));
      continued = true;
    } else if (resumable) {
      cronLogger.warn(
        { hop, nextCursor },
        "Fee generation chain reached its hop limit; the next scheduled run continues it",
      );
    }

    const durationMs = Math.round(elapsed());
    cronLogger.info(
      {
        schoolsCount: results.length,
        totalChargesGenerated: totalGenerated,
        durationMs,
        hop,
        resumable,
        continued,
        nextCursor,
      },
      `[Cron Fee Generation Completed] Generated ${totalGenerated} charges across ${results.length} schools in ${durationMs}ms`,
    );

    return NextResponse.json({
      success: true,
      totalChargesGenerated: totalGenerated,
      details: results,
      resumable,
      continued,
      nextCursor,
      hop,
      durationMs,
    });
  } catch (error: any) {
    const durationMs = Math.round(elapsed());
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

/**
 * Starts the next run. We only wait long enough for it to begin: Vercel keeps
 * a function running when its caller disconnects, and waiting for the whole
 * chain would outlive this function's own time limit.
 */
async function handOff(next: URL, authorization: string) {
  try {
    await fetch(next, {
      headers: { authorization },
      signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError") return;
    cronLogger.error(
      { err, next: next.pathname + next.search },
      "Could not start the next fee generation run; the next scheduled run continues it",
    );
    Sentry.captureException(err, { tags: { job: "cron-generate-fees" } });
  }
}
