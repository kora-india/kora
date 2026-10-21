import { prisma, Prisma } from "@schoolos/db";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";

/**
 * Month-by-month money totals for dashboards, summed in SQL (P1, P3).
 *
 * The dashboards used to load every payment, open fee item and expense of the
 * last six months to group them in JavaScript; for a large school that is tens
 * of thousands of rows to produce a handful of numbers. Months are calendar
 * months in the school's time zone.
 */

export interface MonthBucket {
  /** "2026-10" */
  key: string;
  /** "Oct" */
  label: string;
}

/** The last `count` months up to and including the current one, oldest first. */
export function recentMonths(
  count: number,
  timeZone?: string | null,
  now = new Date(),
): MonthBucket[] {
  const [year, month] = calendarDateInTimeZone(resolveTimeZone(timeZone), now)
    .split("-")
    .map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "short",
        timeZone: "UTC",
      }).format(d),
    };
  });
}

type Row = { month: string; total: number };

const toMap = (rows: Row[]) =>
  new Map(rows.map((r) => [r.month, Number(r.total) || 0]));

/** `schoolId` null means every school (super admin). */
const schoolFilter = (column: Prisma.Sql, schoolId: string | null) =>
  schoolId ? Prisma.sql`AND ${column} = ${schoolId}` : Prisma.empty;

/** The first month's start as a UTC instant, so the (schoolId, date) indexes apply. */
const monthStart = (months: MonthBucket[], tz: string) =>
  Prisma.sql`((${`${months[0].key}-01`}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;

/** Successful collections per month. Advance settlements (ADJUSTMENT) are excluded. */
export async function monthlyCollections(
  schoolId: string | null,
  months: MonthBucket[],
  timeZone?: string | null,
): Promise<Map<string, number>> {
  const tz = resolveTimeZone(timeZone);
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT to_char(date_trunc('month', (pt."date" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM') AS month,
           COALESCE(SUM(pt."amount"), 0)::float8 AS total
    FROM "payment_transactions" pt
    WHERE pt."status" = 'SUCCESS'
      ${schoolFilter(Prisma.sql`pt."schoolId"`, schoolId)}
      AND pt."date" >= ${monthStart(months, tz)}
    GROUP BY 1`;
  return toMap(rows);
}

/** Expenses per month. */
export async function monthlyExpenses(
  schoolId: string,
  months: MonthBucket[],
  timeZone?: string | null,
): Promise<Map<string, number>> {
  const tz = resolveTimeZone(timeZone);
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT to_char(date_trunc('month', (e."date" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM') AS month,
           COALESCE(SUM(e."amount"), 0)::float8 AS total
    FROM "expenses" e
    WHERE e."schoolId" = ${schoolId}
      AND e."date" >= ${monthStart(months, tz)}
    GROUP BY 1`;
  return toMap(rows);
}

/** Still-unpaid amounts of active students' charges, by the charge's due month. */
export async function monthlyPendingDues(
  schoolId: string,
  months: MonthBucket[],
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT to_char(date_trunc('month', fc."dueDate"), 'YYYY-MM') AS month,
           COALESCE(SUM(fci."amount" - fci."paidAmount"), 0)::float8 AS total
    FROM "fee_charge_items" fci
    JOIN "fee_charges" fc ON fc."id" = fci."chargeId"
    JOIN "students" s ON s."id" = fc."studentId"
    WHERE fc."schoolId" = ${schoolId}
      AND s."isActive" = true
      AND fci."status" IN ('PENDING', 'PARTIAL', 'OVERDUE')
      AND fc."dueDate" >= ${`${months[0].key}-01`}::date
    GROUP BY 1`;
  return toMap(rows);
}
