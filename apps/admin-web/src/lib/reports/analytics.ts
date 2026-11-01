import { prisma, Prisma } from "@schoolos/db";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import { analyticsBuckets, type AnalyticsRange } from "./analytics-query";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

const BUCKET_FORMAT = { day: "YYYY-MM-DD", month: "YYYY-MM" } as const;

export interface AnalyticsFilters {
  range: AnalyticsRange;
  /** The dates to compare revenue with. */
  previous?: AnalyticsRange;
  classId?: string | null;
  sectionId?: string | null;
}

/**
 * The school analytics page's figures, all for one period, class and section,
 * summed in SQL. Money uses the same rules as the dashboard and ledger
 * (monthly-totals.ts): dates are the school's, collections exclude advance
 * settlements, and waived fee items are neither billed nor owed. As on the
 * ledger, payments and bills belong to the student's current class; attendance
 * keeps the class it was marked in.
 */
export async function getAnalyticsData(
  schoolId: string,
  timeZone: string | null | undefined,
  { range, previous, classId, sectionId }: AnalyticsFilters,
) {
  const tz = resolveTimeZone(timeZone);
  const today = calendarDateInTimeZone(tz);
  const { unit, buckets } = analyticsBuckets(range, today);
  const format = BUCKET_FORMAT[unit];

  const dayStart = (date: string) =>
    Prisma.sql`((${date}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
  const dayEnd = (date: string) =>
    Prisma.sql`((${date}::date + 1)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
  const scopeOf = (table: string) => {
    const column = (name: string) => Prisma.raw(`${table}."${name}"`);
    return Prisma.sql`${classId ? Prisma.sql`AND ${column("classId")} = ${classId}` : Prisma.empty}
      ${sectionId ? Prisma.sql`AND ${column("sectionId")} = ${sectionId}` : Prisma.empty}`;
  };
  const students = scopeOf("s");
  const paymentsFrom = ({ from, to }: AnalyticsRange) => Prisma.sql`
    FROM "payment_transactions" pt
    JOIN "students" s ON s."id" = pt."studentId"
    WHERE pt."status" = 'SUCCESS'
      AND pt."schoolId" = ${schoolId}
      AND pt."date" >= ${dayStart(from)}
      AND pt."date" < ${dayEnd(to)}
      ${students}`;

  const [collections, previousTotal, feeItems, attendance, enrolment] =
    await Promise.all([
      prisma.$queryRaw<{ bucket: string; method: string; total: number }[]>`
        SELECT to_char(date_trunc(${unit}, (pt."date" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), ${format}) AS bucket,
               pt."method"::text AS method,
               COALESCE(SUM(pt."amount"), 0)::float8 AS total
        ${paymentsFrom(range)}
        GROUP BY 1, 2`,
      previous
        ? prisma.$queryRaw<{ total: number }[]>`
            SELECT COALESCE(SUM(pt."amount"), 0)::float8 AS total
            ${paymentsFrom(previous)}`
        : Promise.resolve([{ total: 0 }]),
      // Fee items due in the period, of current students, not waived.
      prisma.$queryRaw<
        {
          bucket: string;
          name: string;
          billed: number;
          paid: number;
          pending: number;
        }[]
      >`
        SELECT to_char(date_trunc(${unit}, fc."dueDate"::timestamp), ${format}) AS bucket,
               fcp."name" AS name,
               SUM(fci."amount")::float8 AS billed,
               SUM(fci."paidAmount")::float8 AS paid,
               COALESCE(SUM(fci."amount" - fci."paidAmount") FILTER (
                 WHERE fci."status" IN ('PENDING', 'PARTIAL', 'OVERDUE')
               ), 0)::float8 AS pending
        FROM "fee_charge_items" fci
        JOIN "fee_charges" fc ON fc."id" = fci."chargeId"
        JOIN "students" s ON s."id" = fc."studentId"
        JOIN "fee_components" fcp ON fcp."id" = fci."componentId"
        WHERE fc."schoolId" = ${schoolId}
          AND s."isActive" = true
          AND fci."status" <> 'WAIVED'
          AND fc."dueDate" >= ${range.from}::date
          AND fc."dueDate" < (${range.to}::date + 1)
          ${students}
        GROUP BY 1, 2`,
      prisma.$queryRaw<
        { bucket: string; total: number; present: number; days: number }[]
      >`
        SELECT to_char(date_trunc(${unit}, a."date"::timestamp), ${format}) AS bucket,
               COUNT(*)::int AS total,
               (COUNT(*) FILTER (WHERE a."status" = 'PRESENT'))::int AS present,
               COUNT(DISTINCT a."date")::int AS days
        FROM "attendances" a
        WHERE a."schoolId" = ${schoolId}
          AND a."date" >= ${range.from}::date
          AND a."date" <= ${range.to}::date
          ${scopeOf("a")}
        GROUP BY 1`,
      prisma.$queryRaw<{ active: number; joined: number }[]>`
        SELECT (COUNT(*) FILTER (WHERE s."isActive"))::int AS active,
               (COUNT(*) FILTER (
                 WHERE s."createdAt" >= ${dayStart(range.from)}
                   AND s."createdAt" < ${dayEnd(range.to)}
               ))::int AS joined
        FROM "students" s
        WHERE s."schoolId" = ${schoolId}
          ${students}`,
    ]);

  const collectedBy = new Map<string, number>();
  const methods = new Map<string, number>();
  for (const { bucket, method, total } of collections) {
    collectedBy.set(bucket, (collectedBy.get(bucket) ?? 0) + Number(total));
    methods.set(method, (methods.get(method) ?? 0) + Number(total));
  }

  let totalBilled = 0;
  let totalPaid = 0;
  const pendingBy = new Map<string, number>();
  const heads = new Map<string, number>();
  for (const { bucket, name, billed, paid, pending } of feeItems) {
    totalBilled = roundMoney(totalBilled + Number(billed));
    totalPaid = roundMoney(totalPaid + Number(paid));
    pendingBy.set(bucket, (pendingBy.get(bucket) ?? 0) + Number(pending));
    heads.set(name, roundMoney((heads.get(name) ?? 0) + Number(billed)));
  }

  const revenueAreaData: { month: string; type: string; amount: number }[] = [];
  const revenueData = buckets.map(({ key, label }) => {
    const collected = roundMoney(collectedBy.get(key) ?? 0);
    const pending = roundMoney(pendingBy.get(key) ?? 0);
    revenueAreaData.push({
      month: label,
      type: "Collected",
      amount: collected,
    });
    revenueAreaData.push({ month: label, type: "Pending", amount: pending });
    return { month: label, collected, pending };
  });

  const attendanceBy = new Map(attendance.map((a) => [a.bucket, a]));
  const attendanceData = buckets.map(({ key, label }) => {
    const row = attendanceBy.get(key);
    return {
      month: label,
      rate:
        row && row.total > 0 ? Math.round((row.present / row.total) * 100) : 0,
      totalRecords: row?.total ?? 0,
    };
  });

  const sortedHeads = [...heads.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const headsTotal = sortedHeads.reduce((s, c) => s + c.value, 0);
  const feeDistribution = sortedHeads.map((c) => ({
    ...c,
    percentage: headsTotal > 0 ? Math.round((c.value / headsTotal) * 100) : 0,
  }));

  const paymentMethods = [...methods.entries()]
    .map(([method, amount]) => ({ method, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const attendanceTotal = attendance.reduce((s, a) => s + a.total, 0);
  const presentTotal = attendance.reduce((s, a) => s + a.present, 0);
  const daysMarked = attendance.reduce((s, a) => s + a.days, 0);

  const totalRevenue = roundMoney(
    [...collectedBy.values()].reduce((s, v) => s + v, 0),
  );
  const previousRevenue = Number(previousTotal[0]?.total ?? 0);

  return {
    revenueData,
    revenueAreaData,
    attendanceData,
    feeDistribution,
    paymentMethods,
    metrics: {
      totalRevenue,
      revenueChangePct:
        previousRevenue > 0
          ? Math.round(
              ((totalRevenue - previousRevenue) / previousRevenue) * 1000,
            ) / 10
          : null,
      feeCollectionRate:
        totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0,
      totalBilled,
      totalPaid,
      avgAttendanceRate:
        attendanceTotal > 0
          ? Math.round((presentTotal / attendanceTotal) * 100)
          : 0,
      avgPresentPerDay:
        daysMarked > 0 ? Math.round(presentTotal / daysMarked) : 0,
      newEnrolments: enrolment[0]?.joined ?? 0,
      activeStudentCount: enrolment[0]?.active ?? 0,
    },
  };
}
