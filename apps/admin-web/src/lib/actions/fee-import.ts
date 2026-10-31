"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FeeFrequency, FeeStatus, prisma } from "@schoolos/db";
import { compareRollNumbers } from "@schoolos/types";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity, money } from "@/lib/activity";
import { isError, requireSchoolAdmin } from "@/lib/auth-guard";
import {
  PREVIOUS_DUES_CATEGORY,
  PREVIOUS_DUES_HEAD,
  asOfDateError,
  formatAsOfDate,
  planOpeningBalances,
  planTotals,
  type OpeningBalanceRow,
} from "@/lib/fees/opening-balance";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import { invalidateFeesCache } from "@/lib/redis";

/**
 * Bringing a school's earlier fee records into the app. Today that's opening
 * balances (lib/fees/opening-balance.ts). School admins only: these change
 * what parents owe. Every upload is one FeeImport, which can be undone until
 * money has moved against it.
 */

const RowsSchema = z.object({
  asOfDate: z.string(),
  rows: z
    .array(
      z.object({
        sheetRow: z.number().int().positive(),
        admissionNumber: z.string().max(100),
        dues: z.string().max(40),
        advance: z.string().max(40),
      }),
    )
    .min(1, "The file has no students in it")
    .max(20_000, "The file has too many rows"),
});

const ImportSchema = RowsSchema.extend({
  fileName: z.string().max(200).optional(),
  chargedComponentIds: z.array(z.string()).max(200).default([]),
});

async function schoolDates(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  return { today: calendarDateInTimeZone(resolveTimeZone(school?.timezone)) };
}

const currentSession = (schoolId: string) =>
  prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, name: true },
  });

async function planFor(schoolId: string, rows: OpeningBalanceRow[]) {
  const [students, covered] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, admissionNumber: true, name: true, isActive: true },
    }),
    prisma.feeImportStudent.findMany({
      where: { student: { schoolId } },
      select: { studentId: true },
    }),
  ]);
  return planOpeningBalances(
    rows,
    students,
    new Set(covered.map((c) => c.studentId)),
  );
}

export interface FeeImportSummary {
  id: string;
  asOfDate: string;
  fileName: string | null;
  studentCount: number;
  totalDues: number;
  totalAdvance: number;
  createdByName: string;
  createdAt: string;
  undoneAt: string | null;
}

export interface OpeningBalanceSetup {
  session: { id: string; name: string } | null;
  studentCount: number;
  /** The school's date, the latest a balance can be for. */
  today: string;
  /** Fee heads billed once a year or less, which may be charged already. */
  feeHeads: { id: string; name: string; frequency: string }[];
  imports: FeeImportSummary[];
}

/** What the import dialog needs when it opens. */
export async function getOpeningBalanceSetup(): Promise<
  OpeningBalanceSetup | { error: string }
> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const [session, studentCount, imports, { today }] = await Promise.all([
    currentSession(schoolId),
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.feeImport.findMany({
      where: { schoolId, kind: "OPENING_BALANCE" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    schoolDates(schoolId),
  ]);
  const structureItems = session
    ? await prisma.feeStructureItem.findMany({
        where: {
          structure: { schoolId, sessionId: session.id, status: "ACTIVE" },
          component: {
            isActive: true,
            frequency: {
              in: [
                FeeFrequency.QUARTERLY,
                FeeFrequency.HALF_YEARLY,
                FeeFrequency.YEARLY,
                FeeFrequency.ONE_TIME,
              ],
            },
          },
        },
        distinct: ["componentId"],
        select: {
          component: { select: { id: true, name: true, frequency: true } },
        },
      })
    : [];

  return {
    session,
    studentCount,
    today,
    feeHeads: structureItems
      .map((i) => i.component)
      .sort((a, b) => a.name.localeCompare(b.name)),
    imports: imports.map((i) => ({
      id: i.id,
      asOfDate: i.asOfDate.toISOString().slice(0, 10),
      fileName: i.fileName,
      studentCount: i.studentCount,
      totalDues: Number(i.totalDues),
      totalAdvance: Number(i.totalAdvance),
      createdByName: i.createdByName,
      createdAt: i.createdAt.toISOString(),
      undoneAt: i.undoneAt?.toISOString() ?? null,
    })),
  };
}

/** The school's active students, in the order the template lists them. */
export async function getOpeningBalanceTemplate(): Promise<
  | {
      students: {
        admissionNumber: string;
        name: string;
        className: string;
        section: string;
        rollNumber: string;
        parentName: string;
      }[];
    }
  | { error: string }
> {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };

  const students = await prisma.student.findMany({
    where: { schoolId: admin.schoolId, isActive: true },
    select: {
      admissionNumber: true,
      name: true,
      rollNumber: true,
      parentName: true,
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
  return {
    students: students.map((s) => ({
      admissionNumber: s.admissionNumber,
      name: s.name,
      className: s.class.name,
      section: s.section.name,
      rollNumber: s.rollNumber,
      parentName: s.parentName,
    })),
  };
}

/** Checks a filled template and reports what importing it would do. Saves nothing. */
export async function checkOpeningBalances(input: unknown) {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };

  const parsed = RowsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { today } = await schoolDates(admin.schoolId);
  const dateError = asOfDateError(parsed.data.asOfDate, today);
  if (dateError) return { error: dateError };

  const plan = await planFor(admin.schoolId, parsed.data.rows);
  const billed = await prisma.feeCharge.findMany({
    where: {
      schoolId: admin.schoolId,
      importId: null,
      studentId: { in: plan.entries.map((e) => e.studentId) },
    },
    distinct: ["studentId"],
    select: { studentId: true },
  });
  return {
    success: true as const,
    problems: plan.problems,
    alreadyImported: plan.alreadyImported,
    /** Students who already have bills in the app; dues add to those. */
    withExistingBills: billed.length,
    ...planTotals(plan.entries),
  };
}

/** The fee head opening dues are billed under; no structure uses it. */
async function findOrCreatePreviousDues(schoolId: string) {
  const find = () =>
    prisma.feeComponent.findFirst({
      where: {
        schoolId,
        OR: [
          { category: PREVIOUS_DUES_CATEGORY },
          { name: { equals: PREVIOUS_DUES_HEAD, mode: "insensitive" } },
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
        name: PREVIOUS_DUES_HEAD,
        description: "What students owed when the school started using Kora",
        category: PREVIOUS_DUES_CATEGORY,
        amount: 0,
        frequency: FeeFrequency.ONE_TIME,
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
 * Saves a checked template, all of it or none of it: a file with problems is
 * refused, so a school never ends up half imported. Dues become one bill per
 * student, advances a credit on their advance balance, and every student in
 * the file counts as billed up to the balance date.
 */
export async function importOpeningBalances(input: unknown) {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { asOfDate, rows, fileName } = parsed.data;

  const [{ today }, session] = await Promise.all([
    schoolDates(schoolId),
    currentSession(schoolId),
  ]);
  const dateError = asOfDateError(asOfDate, today);
  if (dateError) return { error: dateError };
  if (!session) {
    return { error: "Set a current academic session before importing" };
  }

  const plan = await planFor(schoolId, rows);
  if (plan.problems.length > 0) {
    return { error: "Fix the problems in the file and upload it again" };
  }
  if (plan.entries.length === 0) {
    return { error: "These students already have opening balances" };
  }
  const totals = planTotals(plan.entries);

  try {
    const [component, chargedComponents] = await Promise.all([
      findOrCreatePreviousDues(schoolId),
      prisma.feeComponent.findMany({
        where: { id: { in: parsed.data.chargedComponentIds }, schoolId },
        select: { id: true, name: true },
      }),
    ]);
    const dueDate = new Date(`${asOfDate}T00:00:00Z`);
    const label = formatAsOfDate(asOfDate);
    const status = asOfDate < today ? FeeStatus.OVERDUE : FeeStatus.PENDING;
    const withDues = plan.entries
      .filter((e) => e.dues > 0)
      .map((e) => ({ ...e, chargeId: randomUUID() }));

    const feeImport = await prisma.$transaction(
      async (tx) => {
        const created = await tx.feeImport.create({
          data: {
            schoolId,
            sessionId: session.id,
            asOfDate: dueDate,
            fileName,
            studentCount: totals.students,
            totalDues: totals.totalDues,
            totalAdvance: totals.totalAdvance,
            chargedComponentIds: chargedComponents.map((c) => c.id),
            createdById: admin.id,
            createdByName: admin.name || "Admin",
          },
        });
        // Fails on a student already covered, so two uploads at once can't
        // both go through.
        await tx.feeImportStudent.createMany({
          data: plan.entries.map((e) => ({
            studentId: e.studentId,
            importId: created.id,
          })),
        });
        await tx.feeCharge.createMany({
          data: withDues.map((e) => ({
            id: e.chargeId,
            schoolId,
            studentId: e.studentId,
            sessionId: session.id,
            title: `${PREVIOUS_DUES_HEAD} (as of ${label})`,
            // Not a billing month: this key marks no month as billed by itself.
            periodKey: `opening-${created.id}`,
            dueDate,
            status,
            importId: created.id,
          })),
        });
        await tx.feeChargeItem.createMany({
          data: withDues.map((e) => ({
            chargeId: e.chargeId,
            componentId: component.id,
            amount: e.dues,
            status,
          })),
        });
        await tx.advanceLedger.createMany({
          data: plan.entries
            .filter((e) => e.advance > 0)
            .map((e) => ({
              studentId: e.studentId,
              amount: e.advance,
              description: `Opening advance (as of ${label})`,
              importId: created.id,
            })),
        });
        return created;
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    await invalidateFeesCache(schoolId);
    revalidatePath("/fees");
    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    await logActivity(admin, {
      action: "fee.opening_import",
      module: "fees",
      summary: `Imported opening balances for ${totals.students} student${totals.students === 1 ? "" : "s"} as of ${label}: ${money(totals.totalDues)} dues, ${money(totals.totalAdvance)} advance`,
      entityType: "FeeImport",
      entityId: feeImport.id,
      details: {
        fileName,
        alreadyHadBalance: plan.alreadyImported,
        alreadyCharged: chargedComponents.map((c) => c.name),
      },
    });

    return { success: true as const, id: feeImport.id, ...totals };
  } catch (e: any) {
    if (e?.code === "P2002") {
      return {
        error:
          "Some of these students were imported just now. Upload the file again to check it.",
      };
    }
    return { error: actionErrorMessage(e, "Couldn't import the balances") };
  }
}

/**
 * Removes an import's bills, payments and credits, and bills these students
 * as usual again. Refused once money has moved in the app: someone has paid
 * towards an imported bill, had it waived, or used an imported advance.
 */
export async function undoFeeImport(importId: string) {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };
  const { schoolId } = admin;

  const record = await prisma.feeImport.findFirst({
    where: { id: importId, schoolId },
  });
  if (!record) return { error: "Import not found" };
  if (record.undoneAt) return { error: "This import was already undone" };

  try {
    const blocked = await prisma.$transaction(
      async (tx) => {
        // Payments take this school row first (allocateReceiptNumber), so
        // none can land on a bill between this check and its removal.
        await tx.school.update({
          where: { id: schoolId },
          data: { updatedAt: new Date() },
        });

        const charges = await tx.feeCharge.findMany({
          where: { schoolId, importId },
          select: {
            student: { select: { name: true } },
            items: {
              select: {
                status: true,
                allocations: {
                  select: { payment: { select: { importId: true } } },
                },
              },
            },
          },
        });
        const moved = new Set(
          charges
            .filter((c) =>
              c.items.some(
                (i) =>
                  i.status === FeeStatus.WAIVED ||
                  i.allocations.some((a) => a.payment.importId !== importId),
              ),
            )
            .map((c) => c.student.name),
        );

        const credits = await tx.advanceLedger.groupBy({
          by: ["studentId"],
          where: { importId },
          _sum: { amount: true },
        });
        const balances = await tx.advanceLedger.groupBy({
          by: ["studentId"],
          where: { studentId: { in: credits.map((c) => c.studentId) } },
          _sum: { amount: true },
        });
        const balance = new Map(
          balances.map((b) => [b.studentId, Number(b._sum.amount ?? 0)]),
        );
        const spent = credits
          .filter(
            (c) => (balance.get(c.studentId) ?? 0) < Number(c._sum.amount ?? 0),
          )
          .map((c) => c.studentId);
        if (spent.length > 0) {
          const students = await tx.student.findMany({
            where: { id: { in: spent } },
            select: { name: true },
          });
          for (const s of students) moved.add(s.name);
        }
        if (moved.size > 0) return [...moved];

        await tx.paymentTransaction.deleteMany({
          where: { schoolId, importId },
        });
        await tx.feeCharge.deleteMany({ where: { schoolId, importId } });
        await tx.advanceLedger.deleteMany({ where: { importId } });
        await tx.feeImportStudent.deleteMany({ where: { importId } });
        await tx.feeImport.update({
          where: { id: importId },
          data: { undoneAt: new Date(), undoneById: admin.id },
        });
        return [];
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    if (blocked.length > 0) {
      const names = blocked.slice(0, 3).join(", ");
      const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : "";
      return {
        error: `This import can't be undone: ${names}${more} already paid, had dues waived, or used their advance.`,
      };
    }

    await invalidateFeesCache(schoolId);
    revalidatePath("/fees");
    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    // An upload that never finished was never logged as done.
    if (record.status === "DONE") {
      await logActivity(admin, {
        action:
          record.kind === "FULL_HISTORY"
            ? "fee.history_import_undo"
            : "fee.opening_import_undo",
        module: "fees",
        summary:
          record.kind === "FULL_HISTORY"
            ? `Undid the fee history import of ${record.billCount} bill${record.billCount === 1 ? "" : "s"} for ${record.studentCount} student${record.studentCount === 1 ? "" : "s"}`
            : `Undid the opening balances as of ${formatAsOfDate(record.asOfDate.toISOString().slice(0, 10))} for ${record.studentCount} student${record.studentCount === 1 ? "" : "s"}`,
        entityType: "FeeImport",
        entityId: record.id,
      });
    }
    return { success: true as const };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't undo the import") };
  }
}
