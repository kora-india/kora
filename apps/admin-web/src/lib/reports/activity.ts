import { prisma, Prisma } from "@schoolos/db";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import { resolveLedgerRange } from "./ledger-query";
import { ACTIVITY_PAGE_SIZE, type ActivityQuery } from "./activity-query";

/** One row of the activity log, as the Activity tab shows it. */
export interface ActivityRow {
  id: string;
  /** ISO time. */
  createdAt: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  summary: string;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * One page of a school's activity log, newest first, with the filters applied
 * in SQL. Dates are calendar dates in the school's time zone.
 */
export async function getActivityLog(
  schoolId: string,
  query: ActivityQuery,
  timeZone?: string | null,
  now = new Date(),
) {
  const tz = resolveTimeZone(timeZone);
  const { start, end } = resolveLedgerRange(
    query,
    calendarDateInTimeZone(tz, now),
  );
  const like = query.q ? `%${escapeLike(query.q)}%` : null;

  const where = Prisma.join(
    [
      Prisma.sql`a."schoolId" = ${schoolId}`,
      query.who === "system"
        ? Prisma.sql`a."actorId" IS NULL`
        : query.who !== "all"
          ? Prisma.sql`a."actorId" = ${query.who}`
          : Prisma.empty,
      query.module !== "all"
        ? Prisma.sql`a."module" = ${query.module}`
        : Prisma.empty,
      start
        ? Prisma.sql`a."createdAt" >= ((${start}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`
        : Prisma.empty,
      end
        ? Prisma.sql`a."createdAt" < ((${end}::date + 1)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`
        : Prisma.empty,
      like
        ? Prisma.sql`(a."summary" ILIKE ${like} OR a."actorName" ILIKE ${like})`
        : Prisma.empty,
    ].filter((part) => part !== Prisma.empty),
    " AND ",
  );

  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw<(Omit<ActivityRow, "createdAt"> & { createdAt: Date })[]>`
      SELECT a."id", a."createdAt", a."actorId", a."actorName", a."actorRole",
             a."action", a."module", a."summary", a."details", a."ip", a."userAgent"
      FROM "activity_logs" a
      WHERE ${where}
      ORDER BY a."createdAt" DESC, a."id" DESC
      LIMIT ${ACTIVITY_PAGE_SIZE} OFFSET ${(query.page - 1) * ACTIVITY_PAGE_SIZE}`,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM "activity_logs" a WHERE ${where}`,
  ]);

  return {
    total,
    rows: rows.map(
      (r): ActivityRow => ({ ...r, createdAt: r.createdAt.toISOString() }),
    ),
  };
}

/** Everyone who can appear in a school's log, for the Person filter. */
export function getActivityPeople(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId },
    select: { id: true, name: true, role: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}
