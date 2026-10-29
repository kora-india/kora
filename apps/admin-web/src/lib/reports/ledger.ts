import { prisma, Prisma } from "@schoolos/db";
import { SYSTEM_ROLE } from "@/lib/activity-labels";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import {
  LEDGER_EXPORT_MAX,
  LEDGER_PAGE_SIZE,
  resolveLedgerRange,
  type LedgerQuery,
} from "./ledger-query";

/**
 * The ledger page's data. Every filter is applied in SQL; the totals cover
 * every matching row, and the list is one page of payments, expenses and
 * advance entries merged by date.
 *
 * Dates are calendar dates in the school's time zone.
 */

/** The four totals at the top of the ledger. */
export interface LedgerMetrics {
  totalInflow: number;
  inflowCount: number;
  totalOutflow: number;
  outflowCount: number;
  netPosition: number;
  /** What is still owed on bills due in the period. */
  totalReceivables: number;
  totalBilledFees: number;
  /** Percent of the period's billed fees that is paid. */
  collectionRate: number;
}

/**
 * - collection: a fee payment (money in)
 * - expense: money out
 * - settlement: a student's advance applied to a bill (no new money)
 * - advance: money credited to a student's advance (already counted)
 */
export type LedgerRowKind = "collection" | "expense" | "settlement" | "advance";

/** One line of the ledger list, as the table and the CSV show it. */
export interface LedgerRow {
  key: string;
  kind: LedgerRowKind;
  /** ISO time. */
  date: string;
  amount: number;
  receiptNo: string | null;
  reference: string | null;
  particulars: string;
  detail: string | null;
  method: string | null;
  /** Who recorded it; null when nobody was recorded (older payments). */
  doneBy: { name: string; role: string } | null;
  billUrl: string | null;
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
  const advances = query.stream === "advance";

  // Payments: pt, with the student as s. Advance settlements (status
  // ADJUSTMENT) are listed with the advances; everywhere else they'd count
  // the same rupee twice.
  const tx =
    query.stream === "outflow" || categoryId
      ? NONE
      : Prisma.join(
          [
            advances
              ? Prisma.sql`AND pt."status" = 'ADJUSTMENT'`
              : Prisma.sql`AND pt."status" <> 'ADJUSTMENT'`,
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
    query.stream === "inflow" || advances || has(query.classId) || componentId
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

  // Advance ledger: al, with the student as s. Only under "advance"; entries
  // have no payment mode, and those without a component apply to any.
  const advance =
    !advances || categoryId || has(query.method)
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

type Sum = { total: number; count: number };
type Receivables = { billed: number; paid: number; due: number };

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** The four totals. The Type filter only picks what is listed, not these. */
export async function ledgerMetrics(
  schoolId: string,
  c: Conditions,
): Promise<LedgerMetrics> {
  const [[collections], [expenses], [receivables]] = await Promise.all([
    prisma.$queryRaw<Sum[]>`
      SELECT COALESCE(SUM(pt."amount"), 0)::float8 AS total, COUNT(*)::int AS count
      FROM "payment_transactions" pt
      JOIN "students" s ON s."id" = pt."studentId"
      WHERE pt."schoolId" = ${schoolId} ${c.tx}`,
    prisma.$queryRaw<Sum[]>`
      SELECT COALESCE(SUM(e."amount"), 0)::float8 AS total, COUNT(*)::int AS count
      FROM "expenses" e
      JOIN "expense_categories" ec ON ec."id" = e."categoryId"
      LEFT JOIN "users" u ON u."id" = e."recordedById"
      WHERE e."schoolId" = ${schoolId} ${c.expense}`,
    prisma.$queryRaw<Receivables[]>`
      SELECT COALESCE(SUM(fci."amount") FILTER (WHERE fci."status" <> 'WAIVED'), 0)::float8 AS billed,
             COALESCE(SUM(fci."paidAmount") FILTER (WHERE fci."status" <> 'WAIVED'), 0)::float8 AS paid,
             COALESCE(SUM(GREATEST(fci."amount" - fci."paidAmount", 0)) FILTER (WHERE fci."status" <> 'WAIVED'), 0)::float8 AS due
      FROM "fee_charge_items" fci
      JOIN "fee_charges" fc ON fc."id" = fci."chargeId"
      JOIN "students" s ON s."id" = fc."studentId"
      WHERE fc."schoolId" = ${schoolId} ${c.receivable}`,
  ]);
  return {
    totalInflow: collections.total,
    inflowCount: collections.count,
    totalOutflow: expenses.total,
    outflowCount: expenses.count,
    netPosition: collections.total - expenses.total,
    totalReceivables: receivables.due,
    totalBilledFees: receivables.billed,
    collectionRate: pct(receivables.paid, receivables.billed),
  };
}

type RowRef = { id: string; kind: "payment" | "expense" | "advance" };

/** Every matching entry, newest first, as one list. */
const matchingRows = (schoolId: string, c: Conditions) => Prisma.sql`
  SELECT pt."id", 'payment' AS kind, pt."date" AS at
  FROM "payment_transactions" pt
  JOIN "students" s ON s."id" = pt."studentId"
  WHERE pt."schoolId" = ${schoolId} ${c.tx}
  UNION ALL
  SELECT e."id", 'expense', e."date"
  FROM "expenses" e
  JOIN "expense_categories" ec ON ec."id" = e."categoryId"
  LEFT JOIN "users" u ON u."id" = e."recordedById"
  WHERE e."schoolId" = ${schoolId} ${c.expense}
  UNION ALL
  SELECT al."id", 'advance', al."createdAt"
  FROM "advance_ledgers" al
  JOIN "students" s ON s."id" = al."studentId"
  WHERE s."schoolId" = ${schoolId} ${c.advance}`;

async function countRows(schoolId: string, c: Conditions) {
  const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM (${matchingRows(schoolId, c)}) x`;
  return total;
}

const SYSTEM = { name: "System", role: SYSTEM_ROLE };
const person = { select: { name: true, role: true } } as const;
const section = (s: {
  class?: { name: string } | null;
  section?: { name: string } | null;
}) => [s.class?.name, s.section?.name].filter(Boolean).join("-") || null;

/** `limit` matching rows from `offset`, ready to show. */
export async function ledgerRows(
  schoolId: string,
  c: Conditions,
  { limit, offset }: { limit: number; offset: number },
): Promise<LedgerRow[]> {
  const refs = await prisma.$queryRaw<RowRef[]>`
    SELECT id, kind FROM (${matchingRows(schoolId, c)}) x
    ORDER BY at DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}`;
  const ids = (kind: RowRef["kind"]) =>
    refs.filter((r) => r.kind === kind).map((r) => r.id);
  const student = {
    select: {
      name: true,
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  } as const;

  const [payments, expenses, advances] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: { id: { in: ids("payment") } },
      include: { student },
    }),
    prisma.expense.findMany({
      where: { id: { in: ids("expense") } },
      include: { category: { select: { name: true } }, recordedBy: person },
    }),
    prisma.advanceLedger.findMany({
      where: { id: { in: ids("advance") } },
      include: { student, component: { select: { name: true } } },
    }),
  ]);

  const collectorIds = [
    ...new Set(payments.map((p) => p.collectedById).filter(Boolean)),
  ] as string[];
  const collectors = new Map(
    (collectorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: collectorIds } },
          select: { id: true, name: true, role: true },
        })
      : []
    ).map((u) => [u.id, { name: u.name, role: u.role as string }]),
  );

  const rows = new Map<string, LedgerRow>();
  for (const p of payments) {
    const settlement = p.status === "ADJUSTMENT";
    rows.set(p.id, {
      key: `payment:${p.id}`,
      kind: settlement ? "settlement" : "collection",
      date: p.date.toISOString(),
      amount: Number(p.amount),
      receiptNo: p.receiptNo,
      reference: p.reference,
      particulars: p.student.name,
      detail: settlement ? "Advance used for fees" : section(p.student),
      method: p.method,
      doneBy:
        (p.collectedById && collectors.get(p.collectedById)) ||
        (settlement ? SYSTEM : null),
      billUrl: null,
    });
  }
  for (const e of expenses) {
    rows.set(e.id, {
      key: `expense:${e.id}`,
      kind: "expense",
      date: e.date.toISOString(),
      amount: Number(e.amount),
      receiptNo: null,
      reference: e.referenceNo,
      particulars: e.title,
      detail: e.category.name,
      method: e.paymentMethod,
      doneBy: e.recordedBy,
      billUrl: e.receiptUrl,
    });
  }
  for (const a of advances) {
    rows.set(a.id, {
      key: `advance:${a.id}`,
      kind: "advance",
      date: a.createdAt.toISOString(),
      amount: Number(a.amount),
      receiptNo: null,
      reference: null,
      particulars: a.student.name,
      detail:
        a.description ||
        `Advance credit${a.component ? ` for ${a.component.name}` : ""}`,
      method: null,
      doneBy: null,
      billUrl: null,
    });
  }
  return refs.map((r) => rows.get(r.id)).filter((r): r is LedgerRow => !!r);
}

export async function getLedgerData(
  schoolId: string,
  query: LedgerQuery,
  timeZone?: string | null,
) {
  const listed = ledgerConditions(query, timeZone);
  const totals =
    query.stream === "all"
      ? listed
      : ledgerConditions({ ...query, stream: "all" }, timeZone);
  const [metrics, total, rows] = await Promise.all([
    ledgerMetrics(schoolId, totals),
    countRows(schoolId, listed),
    ledgerRows(schoolId, listed, {
      limit: LEDGER_PAGE_SIZE,
      offset: (query.page - 1) * LEDGER_PAGE_SIZE,
    }),
  ]);
  return { metrics, total, rows, range: listed.range };
}

/** Every matching row for the CSV, newest first, up to `LEDGER_EXPORT_MAX`. */
export async function getLedgerExport(
  schoolId: string,
  query: LedgerQuery,
  timeZone?: string | null,
) {
  const conditions = ledgerConditions(query, timeZone);
  const [total, rows] = await Promise.all([
    countRows(schoolId, conditions),
    ledgerRows(schoolId, conditions, { limit: LEDGER_EXPORT_MAX, offset: 0 }),
  ]);
  return { total, rows };
}
