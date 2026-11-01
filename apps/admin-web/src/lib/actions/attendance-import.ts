"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@schoolos/db";
import { compareRollNumbers } from "@schoolos/types";
import { actionErrorMessage } from "@/lib/action-errors";
import { classLabel, logActivity } from "@/lib/activity";
import {
  planAttendanceImport,
  type AttendanceRow,
  type AttendanceTotals,
} from "@/lib/attendance-import";
import type { AttendanceTemplate } from "@/lib/attendance-template";
import { isError, requirePermission } from "@/lib/auth-guard";
import {
  isPeriodKey,
  parsePeriodKey,
  periodKeyFromDate,
} from "@/lib/fees/billing-period";
import { monthsBetween } from "@/lib/fees/fee-history";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";
import { invalidateCache, invalidateStudentsCache } from "@/lib/redis";
import { findTeacherSections, teachesSection } from "@/lib/teacher-sections";

/**
 * Bringing in past attendance, one section at a time, from a filled template
 * (lib/attendance-import.ts). The file is checked first, days already marked
 * in Kora are left as they are, and an import can be undone. School admins can
 * always do this; anyone else needs Attendance import turned on in Team &
 * Access, and a teacher only reaches their own sections.
 */

const SectionSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
});

const TemplateSchema = SectionSchema.extend({
  from: z.string(),
  to: z.string(),
});

const CheckSchema = SectionSchema.extend({
  rows: z
    .array(
      z.object({
        period: z.string().max(7),
        sheetRow: z.number().int().positive(),
        admissionNumber: z.string().max(100),
        marks: z.record(z.string().max(30)),
      }),
    )
    .min(1)
    .max(5000),
});

const ImportSchema = CheckSchema.extend({
  fileName: z.string().max(200).optional(),
});

const MAX_MONTHS = 12;

const cannotImport = "You can't import attendance for that section";

async function getImportAccess() {
  const access = await requirePermission("attendanceImport", "manage");
  return isError(access) ? null : access;
}

type ImportAccess = NonNullable<Awaited<ReturnType<typeof getImportAccess>>>;

/** The section, if it's this school's and this login may import for it. */
async function findSection(
  user: ImportAccess,
  { classId, sectionId }: z.infer<typeof SectionSchema>,
) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, classId, schoolId: user.schoolId! },
    select: { id: true, name: true, class: { select: { name: true } } },
  });
  if (!section) return null;
  if (user.role === "TEACHER") {
    const teacher = await findTeacherSections(user.id, user.schoolId!);
    if (!teacher || !teachesSection(teacher, classId, sectionId)) return null;
  }
  return section;
}

const schoolToday = async (schoolId: string) => {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true, workingDays: true },
  });
  return {
    today: calendarDateInTimeZone(resolveTimeZone(school?.timezone)),
    workingDays: school?.workingDays ?? [],
  };
};

export interface AttendanceImportSummary {
  id: string;
  className: string;
  sectionName: string;
  fromMonth: string;
  toMonth: string;
  fileName: string | null;
  recordCount: number;
  createdByName: string;
  createdAt: string;
  undoneAt: string | null;
}

export interface AttendanceImportSetup {
  /** Only the sections this login may import for. */
  classes: {
    id: string;
    name: string;
    sections: { id: string; name: string }[];
  }[];
  /** "YYYY-MM": the session's first month, and this month. */
  firstMonth: string;
  currentMonth: string;
  imports: AttendanceImportSummary[];
}

/** What the import dialog needs when it opens. */
export async function getAttendanceImportSetup(): Promise<
  AttendanceImportSetup | { error: string }
> {
  const user = await getImportAccess();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId!;

  const [{ today }, session, classes, imports, teacher] = await Promise.all([
    schoolToday(schoolId),
    prisma.academicSession.findFirst({
      where: { schoolId, isCurrent: true },
      select: { startDate: true },
    }),
    prisma.class.findMany({
      where: { schoolId },
      orderBy: { grade: "asc" },
      select: {
        id: true,
        name: true,
        sections: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.attendanceImport.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    user.role === "TEACHER" ? findTeacherSections(user.id, schoolId) : null,
  ]);

  const mayImport = (classId: string, sectionId: string) =>
    user.role !== "TEACHER" ||
    (teacher !== null && teachesSection(teacher, classId, sectionId));
  const currentMonth = today.slice(0, 7);
  const sessionStart = session ? periodKeyFromDate(session.startDate) : "";

  return {
    classes: classes
      .map((c) => ({
        ...c,
        sections: c.sections.filter((s) => mayImport(c.id, s.id)),
      }))
      .filter((c) => c.sections.length > 0),
    firstMonth:
      sessionStart && sessionStart <= currentMonth
        ? sessionStart
        : currentMonth,
    currentMonth,
    imports: imports
      .filter((i) => mayImport(i.classId, i.sectionId))
      .map((i) => ({
        id: i.id,
        className: i.className,
        sectionName: i.sectionName,
        fromMonth: i.fromMonth,
        toMonth: i.toMonth,
        fileName: i.fileName,
        recordCount: i.recordCount,
        createdByName: i.createdByName,
        createdAt: i.createdAt.toISOString(),
        undoneAt: i.undoneAt?.toISOString() ?? null,
      })),
  };
}

/** A sheet per month, listing the section's current students by roll number. */
export async function getAttendanceTemplate(
  input: unknown,
): Promise<AttendanceTemplate | { error: string }> {
  const user = await getImportAccess();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId!;

  const parsed = TemplateSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a class, section and months" };
  const { from, to, ...ids } = parsed.data;

  const section = await findSection(user, ids);
  if (!section) return { error: cannotImport };

  const { today, workingDays } = await schoolToday(schoolId);
  if (!isPeriodKey(from) || !isPeriodKey(to) || from > to) {
    return { error: "Choose the months to include" };
  }
  if (to > today.slice(0, 7)) {
    return { error: "The last month can't be in the future" };
  }
  const months = monthsBetween(from, to);
  if (months.length > MAX_MONTHS) {
    return { error: `Choose ${MAX_MONTHS} months or fewer at a time` };
  }

  const students = await prisma.student.findMany({
    where: { schoolId, ...ids, isActive: true },
    select: { admissionNumber: true, name: true, rollNumber: true },
  });
  if (students.length === 0) {
    return { error: "This section has no students yet" };
  }
  students.sort((a, b) => compareRollNumbers(a.rollNumber, b.rollNumber));

  return {
    className: section.class.name,
    sectionName: section.name,
    months,
    workingDays,
    today,
    students,
  };
}

/** Works out what the rows would save, given what's already marked. */
async function planRows(
  user: ImportAccess,
  { classId, sectionId }: z.infer<typeof SectionSchema>,
  label: string,
  rows: AttendanceRow[],
) {
  const schoolId = user.schoolId!;
  const [{ today }, students] = await Promise.all([
    schoolToday(schoolId),
    prisma.student.findMany({
      where: { schoolId, classId, sectionId, isActive: true },
      select: { id: true, admissionNumber: true },
    }),
  ]);

  const months = rows
    .map((r) => r.period)
    .filter(isPeriodKey)
    .sort();
  const lastMonth = parsePeriodKey(months.at(-1));
  const marked = lastMonth
    ? await prisma.attendance.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          date: {
            gte: new Date(`${months[0]}-01T00:00:00Z`),
            lt: new Date(Date.UTC(lastMonth.year, lastMonth.month, 1)),
          },
        },
        select: { studentId: true, date: true },
      })
    : [];

  return planAttendanceImport(rows, {
    students,
    sectionName: label,
    existing: new Set(
      marked.map((m) => `${m.studentId}|${m.date.toISOString().slice(0, 10)}`),
    ),
    today,
  });
}

/** Checks a filled template. Saves nothing. */
export async function checkAttendanceImport(
  input: unknown,
): Promise<
  | { success: true; problems: string[]; totals: AttendanceTotals }
  | { error: string }
> {
  const user = await getImportAccess();
  if (!user) return { error: "Unauthorized" };

  const parsed = CheckSchema.safeParse(input);
  if (!parsed.success) return { error: "That file can't be read" };
  const { rows, ...ids } = parsed.data;

  const section = await findSection(user, ids);
  if (!section) return { error: cannotImport };

  const { problems, totals } = await planRows(
    user,
    ids,
    classLabel(section.class.name, section.name),
    rows,
  );
  return { success: true, problems, totals };
}

const refreshAttendance = async (schoolId: string) => {
  await Promise.all([
    invalidateStudentsCache(schoolId),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics:overview`),
  ]);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
};

/** Saves a checked file, all of it or none. */
export async function importAttendance(input: unknown) {
  const user = await getImportAccess();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId!;

  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) return { error: "That file can't be imported" };
  const { rows, fileName, ...ids } = parsed.data;

  const section = await findSection(user, ids);
  if (!section) return { error: cannotImport };

  const label = classLabel(section.class.name, section.name);
  const { records, totals, problems } = await planRows(user, ids, label, rows);
  if (problems.length > 0) return { error: problems[0] };
  if (records.length === 0) {
    return { error: "There's nothing new to import in this file" };
  }

  const months = records.map((r) => r.date.slice(0, 7)).sort();
  try {
    const saved = await prisma.$transaction(
      async (tx) => {
        const record = await tx.attendanceImport.create({
          data: {
            schoolId,
            ...ids,
            className: section.class.name,
            sectionName: section.name,
            fromMonth: months[0],
            toMonth: months[months.length - 1],
            fileName,
            studentCount: totals.students,
            dayCount: totals.days,
            recordCount: records.length,
            skippedCount: totals.alreadyInKora,
            createdById: user.id,
            createdByName: user.name || "Admin",
          },
        });
        // skipDuplicates: a day marked since the check stays as it was marked.
        const { count } = await tx.attendance.createMany({
          data: records.map(({ studentId, date, status }) => ({
            schoolId,
            ...ids,
            studentId,
            date: new Date(`${date}T00:00:00Z`),
            status,
            markedById: user.id,
            importId: record.id,
          })),
          skipDuplicates: true,
        });
        if (count === records.length) return record;
        return tx.attendanceImport.update({
          where: { id: record.id },
          data: {
            recordCount: count,
            skippedCount: totals.alreadyInKora + records.length - count,
          },
        });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    await refreshAttendance(schoolId);
    await logActivity(user, {
      action: "attendance.import",
      module: "attendance",
      summary: `Imported attendance for ${label}: ${saved.recordCount} record${saved.recordCount === 1 ? "" : "s"} over ${totals.days} day${totals.days === 1 ? "" : "s"}`,
      entityType: "AttendanceImport",
      entityId: saved.id,
      details: { fileName, ...totals },
    });
    return {
      success: true as const,
      id: saved.id,
      records: saved.recordCount,
      students: totals.students,
      days: totals.days,
      skipped: saved.skippedCount,
    };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't import that file") };
  }
}

/**
 * Takes an import's records back out. Records changed since belong to whoever
 * changed them (their `importId` was cleared), so they stay.
 */
export async function undoAttendanceImport(importId: string) {
  const user = await getImportAccess();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId!;

  const record = await prisma.attendanceImport.findFirst({
    where: { id: importId, schoolId },
  });
  if (!record) return { error: "That import wasn't found" };
  if (record.undoneAt) return { error: "That import was already undone" };
  if (user.role === "TEACHER") {
    const teacher = await findTeacherSections(user.id, schoolId);
    if (
      !teacher ||
      !teachesSection(teacher, record.classId, record.sectionId)
    ) {
      return { error: cannotImport };
    }
  }

  try {
    const removed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.attendance.deleteMany({ where: { importId } });
      await tx.attendanceImport.update({
        where: { id: importId },
        data: { undoneAt: new Date(), undoneById: user.id },
      });
      return count;
    });

    await refreshAttendance(schoolId);
    await logActivity(user, {
      action: "attendance.import_undo",
      module: "attendance",
      summary: `Undid an attendance import for ${classLabel(record.className, record.sectionName)}: removed ${removed} record${removed === 1 ? "" : "s"}`,
      entityType: "AttendanceImport",
      entityId: importId,
    });
    return {
      success: true as const,
      removed,
      kept: record.recordCount - removed,
    };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't undo the import") };
  }
}
