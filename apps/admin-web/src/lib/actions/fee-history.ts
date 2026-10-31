"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FeeFrequency, FeeStatus, prisma, type Prisma } from "@schoolos/db";
import { compareRollNumbers } from "@schoolos/types";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity, money } from "@/lib/activity";
import { isError, requireSchoolAdmin } from "@/lib/auth-guard";
import {
  billingBucket,
  formatPeriodLabel,
  isPeriodKey,
  periodKeyFromDate,
} from "@/lib/fees/billing-period";
import { deriveChargeStatus } from "@/lib/fees/charge-status";
import {
  LATE_FEE_LINE,
  findSessionForPeriod,
  historyDueDate,
  monthsBetween,
  pastSessionFor,
  planFeeHistory,
  type ExpectedLine,
  type FeeHistoryRow,
  type HistoryContext,
  type HistoryTotals,
} from "@/lib/fees/fee-history";
import type { HistoryTemplate } from "@/lib/fees/fee-history-template";
import { PREVIOUS_DUES_CATEGORY } from "@/lib/fees/opening-balance";
import { formatReceiptNumber } from "@/lib/fees/receipt-number";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import { invalidateFeesCache } from "@/lib/redis";
import type { FeeImportSummary } from "./fee-import";

/**
 * Bringing in a school's bills and payments, month by month, from a filled
 * template (lib/fees/fee-history.ts). A file can be too big for one request,
 * so the browser sends it in batches: every batch is checked, then
 * `startFeeHistoryImport` opens an import, each batch saves under it, and
 * `finishFeeHistoryImport` closes it. If a batch fails, the browser undoes the
 * import, so a school never ends up half imported. School admins only.
 *
 * Every call gets the file's months as well as its rows. A year's fee belongs
 * to the first month of the file, even for a student with that month blank.
 */

const LATE_FEE_CATEGORY = "LATE_FEE";

const RowSchema = z.object({
  sheetRow: z.number().int().positive(),
  admissionNumber: z.string().max(100),
  period: z.string().max(7),
  fees: z.string().max(40),
  lateFee: z.string().max(40),
  paid: z.string().max(40),
  paidOn: z.string().max(40),
  mode: z.string().max(40),
  receiptNo: z.string().max(60),
});

const MonthsSchema = z.array(z.string().max(7)).min(1).max(240);

const CheckSchema = z.object({
  months: MonthsSchema,
  rows: z.array(RowSchema).min(1).max(5000),
  calculateLateFees: z.boolean().default(false),
});

const StartSchema = z.object({
  fileName: z.string().max(200).optional(),
  calculateLateFees: z.boolean().default(false),
  continueLateFees: z.boolean().default(false),
  periods: z.array(z.string()).max(240),
  heads: z.array(z.string().max(100)).max(200),
});

const BatchSchema = z.object({
  importId: z.string().min(1),
  months: MonthsSchema,
  rows: z.array(RowSchema).min(1).max(5000),
});

const LoadTemplateSchema = z.object({ from: z.string(), to: z.string() });

const importSummary = (i: {
  id: string;
  asOfDate: Date;
  fileName: string | null;
  studentCount: number;
  totalDues: unknown;
  totalAdvance: unknown;
  createdByName: string;
  createdAt: Date;
  undoneAt: Date | null;
}): FeeImportSummary => ({
  id: i.id,
  asOfDate: i.asOfDate.toISOString().slice(0, 10),
  fileName: i.fileName,
  studentCount: i.studentCount,
  totalDues: Number(i.totalDues),
  totalAdvance: Number(i.totalAdvance),
  createdByName: i.createdByName,
  createdAt: i.createdAt.toISOString(),
  undoneAt: i.undoneAt?.toISOString() ?? null,
});

export interface FeeHistorySummary extends FeeImportSummary {
  billCount: number;
  totalBilled: number;
  totalPaid: number;
  totalLateFees: number;
  /** False while batches arrive, or if the upload stopped part-way. */
  finished: boolean;
}

export interface FeeHistorySetup {
  session: { id: string; name: string } | null;
  studentCount: number;
  /** "YYYY-MM": the session's first month, and this month. */
  firstMonth: string;
  currentMonth: string;
  /** The school's late-fee rule in words; null if it has none. */
  lateFeeRule: string | null;
  imports: FeeHistorySummary[];
}

/** What the history dialog needs when it opens. */
export async function getFeeHistorySetup(): Promise<
  FeeHistorySetup | { error: string }
> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const [school, session, studentCount, imports] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        timezone: true,
        lateFeeEnabled: true,
        lateFeeAmount: true,
        lateFeeFrequency: true,
      },
    }),
    prisma.academicSession.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true, name: true, startDate: true },
    }),
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.feeImport.findMany({
      where: { schoolId, kind: "FULL_HISTORY" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const currentMonth = calendarDateInTimeZone(
    resolveTimeZone(school?.timezone),
  ).slice(0, 7);
  const sessionStart = session ? periodKeyFromDate(session.startDate) : "";

  return {
    session: session && { id: session.id, name: session.name },
    studentCount,
    firstMonth:
      sessionStart && sessionStart <= currentMonth
        ? sessionStart
        : currentMonth,
    currentMonth,
    lateFeeRule:
      school?.lateFeeEnabled && school.lateFeeAmount
        ? `${money(school.lateFeeAmount)} ${(school.lateFeeFrequency || "MONTHLY").toLowerCase()}`
        : null,
    imports: imports.map((i) => ({
      ...importSummary(i),
      billCount: i.billCount,
      totalBilled: Number(i.totalBilled),
      totalPaid: Number(i.totalPaid),
      totalLateFees: Number(i.totalLateFees),
      finished: i.status === "DONE",
    })),
  };
}

/** The month a bill is for, or null for one that isn't a month's bill. */
const billedPeriod = (charge: { periodKey: string | null; dueDate: Date }) => {
  const key = charge.periodKey;
  if (key?.startsWith("opening-")) return null;
  return isPeriodKey(key) ? key : periodKeyFromDate(charge.dueDate);
};

/**
 * What the fee structure bills each student each month, worked out the same
 * way fee generation does, leaving out months they already have bills for or
 * that an opening balance covers. `months` must be oldest first: a year's fee
 * goes on the first month that isn't left out.
 */
async function loadExpectedBills(
  schoolId: string,
  students: { id: string; classId: string }[],
  months: string[],
) {
  const ids = students.map((s) => s.id);
  const [
    sessions,
    components,
    structures,
    overrides,
    transports,
    charges,
    openings,
  ] = await Promise.all([
    prisma.academicSession.findMany({ where: { schoolId } }),
    prisma.feeComponent.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
    }),
    prisma.classFeeStructure.findMany({
      where: { structure: { schoolId, status: "ACTIVE" } },
      select: {
        classId: true,
        structure: {
          select: {
            sessionId: true,
            items: {
              select: {
                componentId: true,
                amount: true,
                component: { select: { amount: true, frequency: true } },
              },
            },
          },
        },
      },
    }),
    prisma.studentFeeOverride.findMany({
      where: { studentId: { in: ids } },
    }),
    prisma.studentTransport.findMany({
      where: { schoolId, studentId: { in: ids }, status: "ACTIVE" },
    }),
    prisma.feeCharge.findMany({
      where: { schoolId, studentId: { in: ids } },
      select: {
        studentId: true,
        sessionId: true,
        periodKey: true,
        dueDate: true,
        items: { select: { componentId: true } },
      },
    }),
    prisma.feeImportStudent.findMany({
      where: { studentId: { in: ids } },
      select: {
        studentId: true,
        import: {
          select: {
            asOfDate: true,
            sessionId: true,
            chargedComponentIds: true,
          },
        },
      },
    }),
  ]);

  // Late fees and opening dues have their own place, not fee heads.
  const heads = components.filter(
    (c) =>
      c.isActive &&
      c.category !== LATE_FEE_CATEGORY &&
      c.category !== PREVIOUS_DUES_CATEGORY,
  );
  const billable = new Set(heads.map((h) => h.id));
  const frequency = new Map(components.map((c) => [c.id, c.frequency]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const transportHead = heads.find(
    (c) =>
      c.category?.toUpperCase() === "TRANSPORT" ||
      c.name.toLowerCase() === "transport fee",
  );
  const structureItems = new Map<string, typeof structures>();
  for (const s of structures) {
    const key = `${s.classId}|${s.structure.sessionId}`;
    structureItems.set(key, [...(structureItems.get(key) ?? []), s]);
  }
  const override = new Map(
    overrides.map((o) => [`${o.studentId}|${o.sessionId}|${o.componentId}`, o]),
  );
  const transport = new Map(
    transports.map((t) => [`${t.studentId}|${t.sessionId}`, t]),
  );

  const billedMonths = new Set<string>();
  const billedBuckets = new Set<string>();
  const bucketKey = (
    studentId: string,
    componentId: string,
    sessionId: string,
    bucket: string,
  ) =>
    bucket === "ONCE"
      ? `${studentId}|${componentId}|ONCE`
      : `${studentId}|${componentId}|${sessionId}|${bucket}`;
  for (const charge of charges) {
    const period = billedPeriod(charge);
    if (!period) continue;
    billedMonths.add(`${charge.studentId}|${period}`);
    const session = sessionById.get(charge.sessionId);
    if (!session) continue;
    for (const item of charge.items) {
      const bucket = billingBucket(
        frequency.get(item.componentId) ?? "",
        session.startDate,
        period,
      );
      if (bucket) {
        billedBuckets.add(
          bucketKey(charge.studentId, item.componentId, session.id, bucket),
        );
      }
    }
  }
  // Fee heads the school said it had charged before importing balances.
  for (const { studentId, import: opening } of openings) {
    const session = sessionById.get(opening.sessionId);
    if (!session) continue;
    for (const componentId of opening.chargedComponentIds) {
      const bucket = billingBucket(
        frequency.get(componentId) ?? "",
        session.startDate,
        periodKeyFromDate(opening.asOfDate),
      );
      if (bucket) {
        billedBuckets.add(
          bucketKey(studentId, componentId, session.id, bucket),
        );
      }
    }
  }
  const openingMonths = new Map(
    openings.map((o) => [o.studentId, periodKeyFromDate(o.import.asOfDate)]),
  );

  const expected = new Map<string, ExpectedLine[]>();
  for (const student of students) {
    for (const period of months) {
      if (billedMonths.has(`${student.id}|${period}`)) continue;
      const covered = openingMonths.get(student.id);
      if (covered && period <= covered) continue;
      const session = findSessionForPeriod(period, sessions);
      if (!session) continue;

      const amounts = new Map<string, number>();
      const assigned =
        structureItems.get(`${student.classId}|${session.id}`) ?? [];
      for (const item of assigned.flatMap((a) => a.structure.items)) {
        if (!billable.has(item.componentId)) continue;
        const bucket = billingBucket(
          item.component.frequency,
          session.startDate,
          period,
        );
        if (!bucket) continue;
        const seen = bucketKey(
          student.id,
          item.componentId,
          session.id,
          bucket,
        );
        if (billedBuckets.has(seen)) continue;

        const own = override.get(
          `${student.id}|${session.id}|${item.componentId}`,
        );
        if (own?.isExempt) continue;
        let amount =
          own?.amount !== null && own?.amount !== undefined
            ? Number(own.amount)
            : Number(item.amount ?? item.component.amount);
        if (own?.discountAmount) {
          amount = Math.max(0, amount - Number(own.discountAmount));
        }
        if (amount > 0) {
          amounts.set(item.componentId, amount);
          billedBuckets.add(seen);
        }
      }
      const ride = transport.get(`${student.id}|${session.id}`);
      if (
        transportHead &&
        ride &&
        Number(ride.monthlyFee) > 0 &&
        !amounts.has(transportHead.id) &&
        periodKeyFromDate(ride.startDate) <= period &&
        (!ride.endDate || periodKeyFromDate(ride.endDate) >= period)
      ) {
        amounts.set(transportHead.id, Number(ride.monthlyFee));
      }

      expected.set(
        `${student.id}|${period}`,
        heads
          .filter((h) => amounts.has(h.id))
          .map((h) => ({ head: h.name, amount: amounts.get(h.id)! })),
      );
    }
  }
  return { expected, billedMonths, openingMonths };
}

/**
 * The template: a row per active student, leaving out students with nothing
 * left to bring in. Fees come from the fee structure, so the school only
 * fills in what was paid and changes what's different.
 */
export async function getFeeHistoryTemplate(
  input: unknown,
): Promise<HistoryTemplate | { error: string }> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const parsed = LoadTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose the months to include" };
  const { from, to } = parsed.data;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  const currentMonth = calendarDateInTimeZone(
    resolveTimeZone(school?.timezone),
  ).slice(0, 7);
  if (!isPeriodKey(from) || !isPeriodKey(to) || from > to) {
    return { error: "Choose the months to include" };
  }
  if (to > currentMonth) {
    return { error: "The last month can't be in the future" };
  }
  const months = monthsBetween(from, to);
  if (months.length > 60) return { error: "Choose 5 years or fewer at a time" };

  const students = await prisma.student.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      admissionNumber: true,
      name: true,
      rollNumber: true,
      classId: true,
      class: { select: { name: true, grade: true } },
      section: { select: { name: true } },
    },
  });
  students.sort(
    (a, b) =>
      a.class.grade - b.class.grade ||
      a.class.name.localeCompare(b.class.name) ||
      a.section.name.localeCompare(b.section.name) ||
      compareRollNumbers(a.rollNumber, b.rollNumber),
  );

  const { expected, billedMonths, openingMonths } = await loadExpectedBills(
    schoolId,
    students,
    months,
  );
  const isOpen = (studentId: string, period: string) => {
    const covered = openingMonths.get(studentId);
    return (
      !billedMonths.has(`${studentId}|${period}`) &&
      !(covered && period <= covered)
    );
  };

  return {
    months,
    students: students
      .filter((s) => months.some((period) => isOpen(s.id, period)))
      .map((s) => ({
        admissionNumber: s.admissionNumber,
        name: s.name,
        className: s.class.name,
        section: s.section.name,
        fees: months.map((period) => {
          const lines = expected.get(`${s.id}|${period}`) ?? [];
          const total = lines.reduce((sum, l) => sum + l.amount, 0);
          return total > 0 ? Math.round(total * 100) / 100 : null;
        }),
      })),
  };
}

async function loadContext(
  schoolId: string,
  months: string[],
  rows: FeeHistoryRow[],
  calculateLateFees: boolean,
): Promise<HistoryContext> {
  const inFile = new Set(
    rows.map((r) => r.admissionNumber.trim().toLowerCase()),
  );
  const [students, school] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: {
        id: true,
        admissionNumber: true,
        name: true,
        isActive: true,
        classId: true,
      },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        timezone: true,
        lateFeeEnabled: true,
        lateFeeAmount: true,
        lateFeeFrequency: true,
        maxLateFeeCap: true,
      },
    }),
  ]);
  const receipts = [
    ...new Set(rows.map((r) => r.receiptNo.trim()).filter(Boolean)),
  ];
  const [{ expected, billedMonths, openingMonths }, used] = await Promise.all([
    loadExpectedBills(
      schoolId,
      students.filter((s) =>
        inFile.has(s.admissionNumber.trim().toLowerCase()),
      ),
      [...new Set([...months, ...rows.map((r) => r.period)])]
        .filter(isPeriodKey)
        .sort(),
    ),
    prisma.paymentTransaction.findMany({
      where: { schoolId, receiptNo: { in: receipts } },
      select: { receiptNo: true },
    }),
  ]);

  return {
    students,
    billedMonths,
    openingMonths,
    expected,
    usedReceipts: new Set(used.map((p) => p.receiptNo.toLowerCase())),
    today: calendarDateInTimeZone(resolveTimeZone(school?.timezone)),
    lateFeeRule:
      calculateLateFees && school?.lateFeeEnabled && school.lateFeeAmount
        ? {
            lateFeeAmount: Number(school.lateFeeAmount),
            lateFeeFrequency: school.lateFeeFrequency,
            maxLateFeeCap: school.maxLateFeeCap
              ? Number(school.maxLateFeeCap)
              : null,
          }
        : null,
  };
}

/** Checks one batch of a filled template. Saves nothing. */
export async function checkFeeHistory(input: unknown): Promise<
  | {
      success: true;
      problems: string[];
      totals: HistoryTotals;
      /** Fee heads and past sessions importing would add. */
      newHeads: string[];
      newSessions: string[];
      heads: string[];
      periods: string[];
    }
  | { error: string }
> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const parsed = CheckSchema.safeParse(input);
  if (!parsed.success) return { error: "That file can't be read" };

  const [plan, sessions, components] = await Promise.all([
    loadContext(
      schoolId,
      parsed.data.months,
      parsed.data.rows,
      parsed.data.calculateLateFees,
    ).then((context) => planFeeHistory(parsed.data.rows, context)),
    prisma.academicSession.findMany({ where: { schoolId } }),
    prisma.feeComponent.findMany({
      where: { schoolId },
      select: { name: true },
    }),
  ]);
  const current = sessions.find((s) => s.isCurrent);
  if (!current) {
    return { error: "Set a current academic session before importing" };
  }
  const known = new Set(components.map((c) => c.name.toLowerCase()));

  return {
    success: true,
    problems: plan.problems,
    totals: plan.totals,
    heads: plan.heads,
    periods: plan.periods,
    newHeads: plan.heads.filter((h) => !known.has(h.toLowerCase())),
    newSessions: [
      ...new Set(
        plan.periods
          .filter((p) => !findSessionForPeriod(p, sessions))
          .map((p) => pastSessionFor(p, current.startDate).name),
      ),
    ],
  };
}

/** The late fee head the daily job uses, created if the school has none. */
async function findOrCreateLateFee(schoolId: string) {
  const find = () =>
    prisma.feeComponent.findFirst({
      where: {
        schoolId,
        OR: [
          { category: LATE_FEE_CATEGORY },
          { name: { equals: "Late Fee", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
  const existing = await find();
  if (existing) return existing;
  try {
    return await prisma.feeComponent.create({
      data: {
        schoolId,
        name: "Late Fee",
        description: "Automated penalty for overdue payment",
        category: LATE_FEE_CATEGORY,
        amount: 0,
        frequency: FeeFrequency.MONTHLY,
        isOptional: true,
      },
      select: { id: true },
    });
  } catch (e: any) {
    const raced = e?.code === "P2002" ? await find() : null;
    if (raced) return raced;
    throw e;
  }
}

/**
 * Opens an import: adds the past sessions and fee heads the file needs. New
 * fee heads start switched off, because they only exist for old bills; no fee
 * structure uses them, so they are never billed again.
 */
export async function startFeeHistoryImport(
  input: unknown,
): Promise<{ success: true; id: string } | { error: string }> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) return { error: "That file can't be imported" };
  const { periods, heads, fileName, calculateLateFees, continueLateFees } =
    parsed.data;

  try {
    const [school, sessions, components] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
      }),
      prisma.academicSession.findMany({ where: { schoolId } }),
      prisma.feeComponent.findMany({
        where: { schoolId },
        select: { name: true },
      }),
    ]);
    const current = sessions.find((s) => s.isCurrent);
    if (!current) {
      return { error: "Set a current academic session before importing" };
    }

    const missing = new Map(
      periods
        .filter((p) => isPeriodKey(p) && !findSessionForPeriod(p, sessions))
        .map((p) => pastSessionFor(p, current.startDate))
        .map((s) => [s.name, s]),
    );
    await prisma.academicSession.createMany({
      data: [...missing.values()].map((s) => ({
        ...s,
        schoolId,
        isCurrent: false,
      })),
      skipDuplicates: true,
    });

    const known = new Set(components.map((c) => c.name.toLowerCase()));
    await prisma.feeComponent.createMany({
      data: heads
        .filter((name) => !known.has(name.toLowerCase()))
        .map((name) => ({
          schoolId,
          name,
          amount: 0,
          frequency: FeeFrequency.MONTHLY,
          isOptional: true,
          isActive: false,
        })),
      skipDuplicates: true,
    });
    await findOrCreateLateFee(schoolId);

    const today = calendarDateInTimeZone(resolveTimeZone(school?.timezone));
    const record = await prisma.feeImport.create({
      data: {
        schoolId,
        kind: "FULL_HISTORY",
        status: "IMPORTING",
        sessionId: current.id,
        asOfDate: new Date(`${today}T00:00:00Z`),
        fileName,
        studentCount: 0,
        totalDues: 0,
        totalAdvance: 0,
        chargedComponentIds: [],
        calculateLateFees,
        continueLateFees,
        createdById: admin.id,
        createdByName: admin.name || "Admin",
      },
    });
    return { success: true, id: record.id };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't start the import") };
  }
}

const itemStatus = (
  line: { amount: number; paid: number },
  overdue: boolean,
): FeeStatus => {
  if (line.paid >= line.amount) return FeeStatus.PAID;
  if (line.paid > 0) return FeeStatus.PARTIAL;
  return overdue ? FeeStatus.OVERDUE : FeeStatus.PENDING;
};

/** Saves one checked batch under an open import, all of it or none. */
export async function importFeeHistoryBatch(
  input: unknown,
): Promise<{ success: true } | { error: string }> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const parsed = BatchSchema.safeParse(input);
  if (!parsed.success) return { error: "That file can't be imported" };
  const { importId, months, rows } = parsed.data;

  const record = await prisma.feeImport.findFirst({
    where: {
      id: importId,
      schoolId,
      kind: "FULL_HISTORY",
      status: "IMPORTING",
      undoneAt: null,
    },
  });
  if (!record) return { error: "This import isn't open" };

  try {
    const context = await loadContext(
      schoolId,
      months,
      rows,
      record.calculateLateFees,
    );
    const plan = planFeeHistory(rows, context);
    if (plan.problems.length > 0) return { error: plan.problems[0] };

    const [sessions, components, lateFee] = await Promise.all([
      prisma.academicSession.findMany({ where: { schoolId } }),
      prisma.feeComponent.findMany({
        where: { schoolId },
        select: { id: true, name: true },
      }),
      findOrCreateLateFee(schoolId),
    ]);
    const componentId = new Map(
      components.map((c) => [c.name.toLowerCase(), c.id]),
    );
    const today = new Date(`${context.today}T00:00:00Z`);

    const charges: Prisma.FeeChargeCreateManyInput[] = [];
    const items: Prisma.FeeChargeItemCreateManyInput[] = [];
    const itemId = new Map<string, string>();
    for (const bill of plan.bills) {
      const session = findSessionForPeriod(bill.period, sessions);
      if (!session) {
        return {
          error: `No academic session covers ${formatPeriodLabel(bill.period)}`,
        };
      }
      const dueDate = new Date(`${historyDueDate(bill.period)}T00:00:00Z`);
      const billItems = bill.lines.map((line) => {
        const id = randomUUID();
        const component =
          line.head === LATE_FEE_LINE
            ? lateFee.id
            : componentId.get(line.head.toLowerCase());
        if (!component) throw new Error(`Unknown fee head ${line.head}`);
        itemId.set(`${bill.studentId}|${bill.period}|${line.head}`, id);
        return {
          id,
          componentId: component,
          amount: line.amount,
          paidAmount: line.paid,
          status: itemStatus(line, dueDate < today),
        };
      });
      const chargeId = randomUUID();
      charges.push({
        id: chargeId,
        schoolId,
        studentId: bill.studentId,
        sessionId: session.id,
        title: formatPeriodLabel(bill.period),
        periodKey: bill.period,
        dueDate,
        status: deriveChargeStatus(billItems, dueDate, today),
        importId,
      });
      items.push(...billItems.map((item) => ({ ...item, chargeId })));
    }

    const payments: Prisma.PaymentTransactionCreateManyInput[] = [];
    const allocations: Prisma.PaymentAllocationCreateManyInput[] = [];
    const advances: Prisma.AdvanceLedgerCreateManyInput[] = [];
    for (const payment of plan.payments) {
      const id = randomUUID();
      const date = new Date(`${payment.date}T12:00:00Z`);
      const receiptNo =
        payment.receiptNo ??
        `IMP-${importId.slice(-6).toUpperCase()}-${payment.sheetRow}-${payment.period}`;
      payments.push({
        id,
        schoolId,
        studentId: payment.studentId,
        amount: payment.amount,
        method: payment.method as any,
        receiptNo,
        date,
        // Kept with its date, so old payments don't fill "Recent Payments".
        createdAt: date,
        status: "SUCCESS",
        remarks: "Imported from earlier records",
        importId,
      });
      for (const a of payment.allocations) {
        allocations.push({
          paymentId: id,
          chargeItemId: itemId.get(
            `${payment.studentId}|${a.period}|${a.head}`,
          )!,
          amount: a.amount,
        });
      }
      if (payment.advance > 0) {
        advances.push({
          studentId: payment.studentId,
          amount: payment.advance,
          description: `Advance from receipt ${receiptNo}`,
          importId,
          createdAt: date,
        });
      }
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.feeCharge.createMany({ data: charges });
        await tx.feeChargeItem.createMany({ data: items });
        await tx.paymentTransaction.createMany({ data: payments });
        await tx.paymentAllocation.createMany({ data: allocations });
        await tx.advanceLedger.createMany({ data: advances });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
    return { success: true };
  } catch (e: any) {
    if (e?.code === "P2002") {
      return {
        error:
          "Some of these months or receipts were added just now. Upload the file again to check it.",
      };
    }
    return { error: actionErrorMessage(e, "Couldn't import that batch") };
  }
}

/** Closes an import: records its totals and logs it. */
export async function finishFeeHistoryImport(importId: string) {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const record = await prisma.feeImport.findFirst({
    where: { id: importId, schoolId, status: "IMPORTING", undoneAt: null },
  });
  if (!record) return { error: "This import isn't open" };

  try {
    const inImport = { charge: { importId } };
    const [
      billCount,
      billed,
      lateFees,
      paid,
      advance,
      bills,
      receipts,
      school,
    ] = await Promise.all([
      prisma.feeCharge.count({ where: { importId } }),
      prisma.feeChargeItem.aggregate({
        where: inImport,
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.feeChargeItem.aggregate({
        where: { ...inImport, component: { category: LATE_FEE_CATEGORY } },
        _sum: { amount: true },
      }),
      prisma.paymentTransaction.aggregate({
        where: { importId },
        _sum: { amount: true },
      }),
      prisma.advanceLedger.aggregate({
        where: { importId },
        _sum: { amount: true },
      }),
      prisma.feeCharge.findMany({
        where: { importId },
        distinct: ["studentId"],
        select: { studentId: true },
      }),
      prisma.paymentTransaction.findMany({
        where: { importId },
        select: { receiptNo: true, studentId: true },
      }),
      prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: {
          timezone: true,
          receiptPrefix: true,
          receiptFormat: true,
          nextReceiptNumber: true,
        },
      }),
    ]);

    const totalBilled = Number(billed._sum.amount ?? 0);
    const totalPaid = Number(paid._sum.amount ?? 0);
    const totalAdvance = Number(advance._sum.amount ?? 0);
    const totalLateFees = Number(lateFees._sum.amount ?? 0);
    const totalDues =
      Math.round((totalBilled - Number(billed._sum.paidAmount ?? 0)) * 100) /
      100;
    const studentCount = new Set([
      ...bills.map((b) => b.studentId),
      ...receipts.map((r) => r.studentId),
    ]).size;

    // New receipts skip numbers already used, but only a few times over: an
    // old receipt book in the school's own format must not block them.
    const year = Number(
      calendarDateInTimeZone(resolveTimeZone(school.timezone)).slice(0, 4),
    );
    let lastUsed = 0;
    for (const { receiptNo } of receipts) {
      const sequence = Number(/(\d+)\D*$/.exec(receiptNo)?.[1] ?? 0);
      if (
        sequence > lastUsed &&
        formatReceiptNumber(
          school.receiptFormat,
          school.receiptPrefix,
          sequence,
          year,
        ) === receiptNo
      ) {
        lastUsed = sequence;
      }
    }

    await prisma.$transaction([
      prisma.feeImport.update({
        where: { id: importId },
        data: {
          status: "DONE",
          studentCount,
          billCount,
          totalBilled,
          totalPaid,
          totalLateFees,
          totalDues,
          totalAdvance,
        },
      }),
      prisma.school.updateMany({
        where: { id: schoolId, nextReceiptNumber: { lte: lastUsed } },
        data: { nextReceiptNumber: lastUsed + 1 },
      }),
    ]);

    await invalidateFeesCache(schoolId);
    revalidatePath("/fees");
    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    await logActivity(admin, {
      action: "fee.history_import",
      module: "fees",
      summary: `Imported fee history for ${studentCount} student${studentCount === 1 ? "" : "s"}: ${billCount} bill${billCount === 1 ? "" : "s"}, ${money(totalBilled)} billed, ${money(totalPaid)} paid, ${money(totalDues)} still due`,
      entityType: "FeeImport",
      entityId: importId,
      details: {
        fileName: record.fileName,
        lateFees: totalLateFees,
        advance: totalAdvance,
        payments: receipts.length,
        lateFeesFromRule: record.calculateLateFees,
        lateFeesContinue: record.continueLateFees,
      },
    });

    return {
      success: true as const,
      students: studentCount,
      bills: billCount,
      billed: totalBilled,
      paid: totalPaid,
      dues: totalDues,
      lateFees: totalLateFees,
      advance: totalAdvance,
    };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't finish the import") };
  }
}
