import { prisma, Prisma } from "@schoolos/db";
import type { LedgerMetrics } from "@/components/ledger/ledger-stat-cards";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import { resolveLedgerRange, type LedgerQuery } from "./ledger-query";

/**
 * The ledger page's data (P2). Every filter is applied in SQL, the stat cards
 * are summed over all matching rows, and only the newest `limit` rows of each
 * stream are sent to the browser. The page used to ship up to 200 rows per
 * stream and total those, so any school with more than 200 payments in the
 * period saw its collections undercounted.
 *
 * Dates are calendar dates in the school's time zone.
 */

export interface LedgerTotals {
  /** Matching rows per stream (the table may list fewer). */
  transactions: number;
  expenses: number;
  advances: number;
}

type TxGroup = {
  collection: boolean;
  method: string;
  classId: string | null;
  total: number;
  count: number;
};
type ComponentGroup = {
  id: string;
  name: string;
  category: string | null;
  total: number;
  count: number;
};
type ExpenseGroup = {
  id: string;
  name: string;
  cash: boolean;
  total: number;
  count: number;
};
type AdvanceTotal = { total: number; count: number };
type ReceivableGroup = {
  classId: string | null;
  billed: number;
  paid: number;
  due: number;
};

export interface LedgerAggregates {
  tx: TxGroup[];
  components: ComponentGroup[];
  expenses: ExpenseGroup[];
  advances: AdvanceTotal;
  receivables: ReceivableGroup[];
}

const NONE = Prisma.sql`AND FALSE`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** SQL conditions for each stream; each one is a series of `AND ...`. */
export function ledgerConditions(
  query: LedgerQuery,
  timeZone?: string | null,
  now = new Date(),
) {
  const tz = resolveTimeZone(timeZone);
  const { start, end } = resolveLedgerRange(
    query,
    calendarDateInTimeZone(tz, now),
  );

  // Local dates turned into UTC instants, so the (schoolId, date) indexes apply.
  const instantRange = (column: Prisma.Sql) =>
    Prisma.sql`${
      start
        ? Prisma.sql`AND ${column} >= ((${start}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`
        : Prisma.empty
    } ${
      end
        ? Prisma.sql`AND ${column} < ((${end}::date + 1)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`
        : Prisma.empty
    }`;
  const dateRange = (column: Prisma.Sql) =>
    Prisma.sql`${start ? Prisma.sql`AND ${column} >= ${start}::date` : Prisma.empty} ${
      end ? Prisma.sql`AND ${column} <= ${end}::date` : Prisma.empty
    }`;

  const like = query.q ? `%${escapeLike(query.q)}%` : null;
  const componentId = query.item.startsWith("comp_")
    ? query.item.slice(5)
    : null;
  const categoryId = query.item.startsWith("cat_") ? query.item.slice(4) : null;
  const has = (v: string) => v !== "all";
  const and = (on: unknown, sql: Prisma.Sql) => (on ? sql : Prisma.empty);

  // Payments: pt, with the student as s.
  const tx =
    query.stream === "outflow" || query.stream === "advance" || categoryId
      ? NONE
      : Prisma.join(
          [
            instantRange(Prisma.sql`pt."date"`),
            and(
              has(query.method),
              Prisma.sql`AND pt."method"::text = ${query.method}`,
            ),
            and(
              has(query.classId),
              Prisma.sql`AND s."classId" = ${query.classId}`,
            ),
            and(
              has(query.sessionId),
              Prisma.sql`AND EXISTS (
                SELECT 1 FROM "payment_allocations" xa
                JOIN "fee_charge_items" xi ON xi."id" = xa."chargeItemId"
                JOIN "fee_charges" xc ON xc."id" = xi."chargeId"
                WHERE xa."paymentId" = pt."id" AND xc."sessionId" = ${query.sessionId})`,
            ),
            and(
              componentId,
              Prisma.sql`AND EXISTS (
                SELECT 1 FROM "payment_allocations" xa
                JOIN "fee_charge_items" xi ON xi."id" = xa."chargeItemId"
                WHERE xa."paymentId" = pt."id" AND xi."componentId" = ${componentId})`,
            ),
            and(
              like,
              Prisma.sql`AND (pt."receiptNo" ILIKE ${like} OR s."name" ILIKE ${like}
                OR s."rollNumber" ILIKE ${like} OR pt."reference" ILIKE ${like}
                OR pt."remarks" ILIKE ${like})`,
            ),
          ],
          " ",
        );

  // Expenses: e, category ec, recorder u. They are school-wide, so a class
  // filter leaves them out.
  const expense =
    query.stream === "inflow" ||
    query.stream === "advance" ||
    has(query.classId) ||
    componentId
      ? NONE
      : Prisma.join(
          [
            instantRange(Prisma.sql`e."date"`),
            and(
              has(query.method),
              Prisma.sql`AND e."paymentMethod"::text = ${query.method}`,
            ),
            and(categoryId, Prisma.sql`AND e."categoryId" = ${categoryId}`),
            and(
              like,
              Prisma.sql`AND (e."title" ILIKE ${like} OR e."description" ILIKE ${like}
                OR e."referenceNo" ILIKE ${like} OR ec."name" ILIKE ${like}
                OR u."name" ILIKE ${like})`,
            ),
          ],
          " ",
        );

  // Advance ledger: al, with the student as s. Entries without a component
  // apply to any component.
  const advance =
    query.stream === "outflow" || categoryId
      ? NONE
      : Prisma.join(
          [
            instantRange(Prisma.sql`al."createdAt"`),
            and(
              has(query.classId),
              Prisma.sql`AND s."classId" = ${query.classId}`,
            ),
            and(
              componentId,
              Prisma.sql`AND (al."componentId" IS NULL OR al."componentId" = ${componentId})`,
            ),
            and(
              like,
              Prisma.sql`AND (s."name" ILIKE ${like} OR s."rollNumber" ILIKE ${like}
                OR al."description" ILIKE ${like})`,
            ),
          ],
          " ",
        );

  // Billed fee items: fci, charge fc, student s, by the charge's due date.
  const receivable = categoryId
    ? NONE
    : Prisma.join(
        [
          dateRange(Prisma.sql`fc."dueDate"`),
          and(
            has(query.sessionId),
            Prisma.sql`AND fc."sessionId" = ${query.sessionId}`,
          ),
          and(componentId, Prisma.sql`AND fci."componentId" = ${componentId}`),
          and(
            has(query.classId),
            Prisma.sql`AND s."classId" = ${query.classId}`,
          ),
        ],
        " ",
      );

  return { tx, expense, advance, receivable, range: { start, end } };
}

type Conditions = ReturnType<typeof ledgerConditions>;

export async function ledgerAggregates(
  schoolId: string,
  c: Conditions,
): Promise<LedgerAggregates> {
  const [tx, components, expenses, advances, receivables] = await Promise.all([
    prisma.$queryRaw<TxGroup[]>`
      SELECT (pt."status" <> 'ADJUSTMENT') AS collection,
             pt."method"::text AS method,
             s."classId" AS "classId",
             SUM(pt."amount")::float8 AS total,
             COUNT(*)::int AS count
      FROM "payment_transactions" pt
      JOIN "students" s ON s."id" = pt."studentId"
      WHERE pt."schoolId" = ${schoolId} ${c.tx}
      GROUP BY 1, 2, 3`,
    // Allocations of every matching payment, advance settlements included,
    // as the component split shows where money was applied.
    prisma.$queryRaw<ComponentGroup[]>`
      SELECT fci."componentId" AS id, comp."name" AS name, comp."category" AS category,
             SUM(pa."amount")::float8 AS total,
             COUNT(*)::int AS count
      FROM "payment_allocations" pa
      JOIN "payment_transactions" pt ON pt."id" = pa."paymentId"
      JOIN "students" s ON s."id" = pt."studentId"
      JOIN "fee_charge_items" fci ON fci."id" = pa."chargeItemId"
      JOIN "fee_components" comp ON comp."id" = fci."componentId"
      WHERE pt."schoolId" = ${schoolId} ${c.tx}
      GROUP BY 1, 2, 3`,
    prisma.$queryRaw<ExpenseGroup[]>`
      SELECT e."categoryId" AS id, ec."name" AS name,
             (e."paymentMethod" = 'CASH') AS cash,
             SUM(e."amount")::float8 AS total,
             COUNT(*)::int AS count
      FROM "expenses" e
      JOIN "expense_categories" ec ON ec."id" = e."categoryId"
      LEFT JOIN "users" u ON u."id" = e."recordedById"
      WHERE e."schoolId" = ${schoolId} ${c.expense}
      GROUP BY 1, 2, 3`,
    prisma.$queryRaw<AdvanceTotal[]>`
      SELECT COALESCE(SUM(al."amount"), 0)::float8 AS total, COUNT(*)::int AS count
      FROM "advance_ledgers" al
      JOIN "students" s ON s."id" = al."studentId"
      WHERE s."schoolId" = ${schoolId} ${c.advance}`,
    prisma.$queryRaw<ReceivableGroup[]>`
      SELECT s."classId" AS "classId",
             COALESCE(SUM(fci."amount") FILTER (WHERE fci."status" <> 'WAIVED'), 0)::float8 AS billed,
             COALESCE(SUM(fci."paidAmount") FILTER (WHERE fci."status" <> 'WAIVED'), 0)::float8 AS paid,
             COALESCE(SUM(GREATEST(fci."amount" - fci."paidAmount", 0)) FILTER (WHERE fci."status" <> 'WAIVED'), 0)::float8 AS due
      FROM "fee_charge_items" fci
      JOIN "fee_charges" fc ON fc."id" = fci."chargeId"
      JOIN "students" s ON s."id" = fc."studentId"
      WHERE fc."schoolId" = ${schoolId} ${c.receivable}
      GROUP BY 1`,
  ]);
  return {
    tx,
    components,
    expenses,
    advances: advances[0] ?? { total: 0, count: 0 },
    receivables,
  };
}

const methodBucket = (method: string) => {
  const m = (method || "OTHER").toUpperCase();
  if (m === "CASH") return "cash";
  if (m === "UPI") return "upi";
  if (["BANK_TRANSFER", "NEFT", "RTGS", "IMPS"].includes(m))
    return "bankTransfer";
  if (m === "CHEQUE" || m === "DD") return "cheque";
  if (["CREDIT_CARD", "DEBIT_CARD", "CARD"].includes(m)) return "card";
  return "other";
};

const PERIOD_DAYS: Partial<Record<LedgerQuery["period"], number>> = {
  today: 1,
  yesterday: 1,
  this_week: 7,
  this_month: 30,
  last_month: 30,
  this_year: 365,
};

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** Stat-card figures from the SQL groups. */
export function buildLedgerMetrics(
  agg: LedgerAggregates,
  classes: { id: string; name: string; grade?: number | null }[],
  period: LedgerQuery["period"],
): LedgerMetrics {
  // Advance settlements (status ADJUSTMENT) move money a student already paid
  // onto a new charge, so they are not new collections.
  const collections = agg.tx.filter((g) => g.collection);
  const totalInflow = collections.reduce((s, g) => s + g.total, 0);
  const inflowCount = collections.reduce((s, g) => s + g.count, 0);

  const totalOutflow = agg.expenses.reduce((s, g) => s + g.total, 0);
  const outflowCount = agg.expenses.reduce((s, g) => s + g.count, 0);

  const totalBilledFees = agg.receivables.reduce((s, g) => s + g.billed, 0);
  const totalPaidFromCharges = agg.receivables.reduce((s, g) => s + g.paid, 0);

  const methodStats: LedgerMetrics["methodStats"] = {
    cash: { inflow: 0, outflow: 0, net: 0, count: 0 },
    upi: { inflow: 0, count: 0 },
    bankTransfer: { inflow: 0, count: 0 },
    cheque: { inflow: 0, count: 0 },
    card: { inflow: 0, count: 0 },
    other: { inflow: 0, count: 0 },
  };
  for (const g of collections) {
    const bucket = methodStats[methodBucket(g.method)];
    bucket.inflow += g.total;
    bucket.count += g.count;
  }
  for (const g of agg.expenses) {
    if (!g.cash) continue;
    methodStats.cash.outflow += g.total;
    methodStats.cash.count += g.count;
  }
  methodStats.cash.net = methodStats.cash.inflow - methodStats.cash.outflow;

  const totalAllocated = agg.components.reduce((s, g) => s + g.total, 0);
  const componentDistribution = agg.components
    .map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category ?? undefined,
      amount: g.total,
      count: g.count,
      percentage: pct(g.total, totalAllocated),
    }))
    .sort((a, b) => b.amount - a.amount);

  const categories = new Map<
    string,
    { id: string; name: string; amount: number; count: number }
  >();
  for (const g of agg.expenses) {
    const c = categories.get(g.id) ?? {
      id: g.id,
      name: g.name || "General Operational",
      amount: 0,
      count: 0,
    };
    c.amount += g.total;
    c.count += g.count;
    categories.set(g.id, c);
  }
  const categoryDistribution = Array.from(categories.values())
    .map((c) => ({ ...c, percentage: pct(c.amount, totalOutflow) }))
    .sort((a, b) => b.amount - a.amount);

  const byClass = new Map(
    classes.map((c) => [
      c.id,
      {
        classId: c.id,
        className: c.name,
        grade: c.grade ?? 0,
        collectedAmount: 0,
        receivables: 0,
        transactionCount: 0,
      },
    ]),
  );
  for (const g of collections) {
    const row = g.classId ? byClass.get(g.classId) : undefined;
    if (!row) continue;
    row.collectedAmount += g.total;
    row.transactionCount += g.count;
  }
  for (const g of agg.receivables) {
    const row = g.classId ? byClass.get(g.classId) : undefined;
    if (row) row.receivables += g.due;
  }
  const classBreakdown = Array.from(byClass.values())
    .map((row) => {
      const billed = row.collectedAmount + row.receivables;
      return {
        ...row,
        recoveryRate:
          billed > 0 ? Math.round((row.collectedAmount / billed) * 100) : 0,
      };
    })
    .sort((a, b) => {
      const activeA = a.collectedAmount > 0 || a.receivables > 0 ? 1 : 0;
      const activeB = b.collectedAmount > 0 || b.receivables > 0 ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;
      if (b.collectedAmount !== a.collectedAmount) {
        return b.collectedAmount - a.collectedAmount;
      }
      return b.receivables - a.receivables;
    });

  return {
    totalInflow,
    inflowCount,
    avgInflow: inflowCount > 0 ? totalInflow / inflowCount : 0,
    totalOutflow,
    outflowCount,
    avgOutflow: outflowCount > 0 ? totalOutflow / outflowCount : 0,
    netPosition: totalInflow - totalOutflow,
    totalAdvanceBalance: agg.advances.total,
    advanceEntriesCount: agg.advances.count,
    totalReceivables: Math.max(0, totalBilledFees - totalPaidFromCharges),
    totalBilledFees,
    collectionRate: pct(totalPaidFromCharges, totalBilledFees),
    totalTransactionsCount: inflowCount + outflowCount + agg.advances.count,
    activePeriodDays: PERIOD_DAYS[period] ?? 30,
    methodStats,
    componentDistribution,
    categoryDistribution,
    classBreakdown,
  };
}

/** Rows in the given id order (`findMany` with `in` does not keep it). */
const inOrder = <T extends { id: string }>(ids: string[], rows: T[]) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => Boolean(r));
};

type IdRow = { id: string };

/** The newest `limit` matching rows of each stream, with what the table shows. */
export async function ledgerRows(
  schoolId: string,
  c: Conditions,
  limit: number,
) {
  const [txIds, expenseIds, advanceIds] = await Promise.all([
    prisma.$queryRaw<IdRow[]>`
      SELECT pt."id" FROM "payment_transactions" pt
      JOIN "students" s ON s."id" = pt."studentId"
      WHERE pt."schoolId" = ${schoolId} ${c.tx}
      ORDER BY pt."date" DESC, pt."id" DESC
      LIMIT ${limit}`,
    prisma.$queryRaw<IdRow[]>`
      SELECT e."id" FROM "expenses" e
      JOIN "expense_categories" ec ON ec."id" = e."categoryId"
      LEFT JOIN "users" u ON u."id" = e."recordedById"
      WHERE e."schoolId" = ${schoolId} ${c.expense}
      ORDER BY e."date" DESC, e."id" DESC
      LIMIT ${limit}`,
    prisma.$queryRaw<IdRow[]>`
      SELECT al."id" FROM "advance_ledgers" al
      JOIN "students" s ON s."id" = al."studentId"
      WHERE s."schoolId" = ${schoolId} ${c.advance}
      ORDER BY al."createdAt" DESC, al."id" DESC
      LIMIT ${limit}`,
  ]);

  const ids = (rows: IdRow[]) => rows.map((r) => r.id);
  const [transactions, expenses, advances] = await Promise.all([
    txIds.length
      ? prisma.paymentTransaction.findMany({
          where: { id: { in: ids(txIds) } },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                rollNumber: true,
                classId: true,
                class: { select: { id: true, name: true, grade: true } },
              },
            },
            allocations: {
              select: {
                id: true,
                amount: true,
                chargeItem: {
                  select: {
                    id: true,
                    componentId: true,
                    component: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        })
      : [],
    expenseIds.length
      ? prisma.expense.findMany({
          where: { id: { in: ids(expenseIds) } },
          include: {
            category: { select: { id: true, name: true } },
            recordedBy: { select: { name: true } },
          },
        })
      : [],
    advanceIds.length
      ? prisma.advanceLedger.findMany({
          where: { id: { in: ids(advanceIds) } },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                rollNumber: true,
                classId: true,
                class: { select: { id: true, name: true } },
              },
            },
            component: { select: { id: true, name: true } },
          },
        })
      : [],
  ]);

  return {
    transactions: inOrder(ids(txIds), transactions),
    expenses: inOrder(ids(expenseIds), expenses),
    advances: inOrder(ids(advanceIds), advances),
  };
}

export async function getLedgerData(
  schoolId: string,
  query: LedgerQuery,
  classes: { id: string; name: string; grade?: number | null }[],
  timeZone?: string | null,
) {
  const conditions = ledgerConditions(query, timeZone);
  const [aggregates, rows] = await Promise.all([
    ledgerAggregates(schoolId, conditions),
    ledgerRows(schoolId, conditions, query.limit),
  ]);
  const totals: LedgerTotals = {
    transactions: aggregates.tx.reduce((s, g) => s + g.count, 0),
    expenses: aggregates.expenses.reduce((s, g) => s + g.count, 0),
    advances: aggregates.advances.count,
  };
  return {
    ...rows,
    range: conditions.range,
    totals,
    metrics: buildLedgerMetrics(aggregates, classes, query.period),
  };
}
