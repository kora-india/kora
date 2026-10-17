"use server";

import { z } from "zod";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@schoolos/logger";
import {
  generateTimetable,
  validateAndRefineAiTimetable,
  detectManualConflict,
  DEFAULT_PERIODS,
  PeriodDefinition,
  SubjectQuota,
  ExistingSlot,
} from "../timetable-generator";
import { generateAiScheduleDraft, AiTimetableResponse } from "../gemini";

const slotSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  dayOfWeek: z.number().min(1).max(7),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  subjectName: z.string().min(1, "Subject name is required"),
  teacherId: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  periodId: z.string().nullable().optional(),
  academicYear: z.string().nullable().optional(),
});

const aiTimetableLimiter = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkAiRateLimit(schoolId: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const key = `ratelimit:ai-timetable:${schoolId}`;
  const entry = aiTimetableLimiter.get(key);
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxAllowed = 10; // 10 AI generation calls per hour per school

  if (!entry || now > entry.resetAt) {
    aiTimetableLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= maxAllowed) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  entry.count += 1;
  return { allowed: true };
}

async function requireTimetableAccess(
  allowedRoles?: ("SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "ACCOUNTANT")[],
) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const user = session.user;
  const schoolId = user.schoolId as string;

  if (allowedRoles && !allowedRoles.includes(user.role as any)) {
    throw new Error("Forbidden: You do not have permission for this action");
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      isActive: true,
      plan: true,
      subscription: { select: { plan: true, status: true } },
    },
  });
  if (!school) throw new Error("School not found");
  if (!school.isActive) throw new Error("Your school account is suspended");

  if (user.role !== "SUPER_ADMIN") {
    const { hasFeatureAccess } = await import("@/lib/subscription");
    const allowed = hasFeatureAccess(
      school.plan,
      school.subscription?.status || "ACTIVE",
      "TIMETABLE",
    );
    if (!allowed) {
      throw new Error(
        "Timetable feature is not included in your subscription plan",
      );
    }
  }

  return { session, user: { ...user, schoolId } };
}

export async function getTimetablePeriods() {
  const { user } = await requireTimetableAccess();
  const schoolId = user.schoolId;

  let periods = await prisma.timetablePeriod.findMany({
    where: { schoolId },
    orderBy: [{ periodNumber: "asc" }, { startTime: "asc" }],
  });

  // If none configured yet, seed the default periods for this school.
  // skipDuplicates: two first loads at once must not fail on the unique
  // start time (D10).
  if (periods.length === 0) {
    await prisma.timetablePeriod.createMany({
      data: DEFAULT_PERIODS.map((dp) => ({
        schoolId,
        periodNumber: dp.periodNumber,
        name: dp.name,
        startTime: dp.startTime,
        endTime: dp.endTime,
        isBreak: dp.isBreak,
      })),
      skipDuplicates: true,
    });

    periods = await prisma.timetablePeriod.findMany({
      where: { schoolId },
      orderBy: [{ periodNumber: "asc" }, { startTime: "asc" }],
    });
  }

  return periods;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const periodSettingsSchema = z
  .array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Every period needs a name").max(50),
      periodNumber: z.number().int().min(1),
      startTime: z.string().regex(TIME_RE, "Times must be HH:MM"),
      endTime: z.string().regex(TIME_RE, "Times must be HH:MM"),
      isBreak: z.boolean(),
    }),
  )
  .min(1, "Add at least one period");

/**
 * Saves the school's bell schedule.
 *
 * D7: periods are updated in place, and their scheduled classes move with
 * them when their times change. This used to delete and recreate every
 * period, which unlinked every class from its period and left classes at
 * changed times off the grid. Removing a period that still has classes
 * scheduled needs `removeScheduledClasses: true`; otherwise the save is
 * refused with `code: "PERIOD_HAS_CLASSES"` and the number of classes.
 */
export async function savePeriodSettings(
  periodsData: Array<{
    id?: string;
    name: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    isBreak: boolean;
  }>,
  options: { removeScheduledClasses?: boolean } = {},
): Promise<
  | { success: true; removedClasses: number }
  | {
      success: false;
      error: string;
      code?: "PERIOD_HAS_CLASSES";
      affectedClasses?: number;
    }
> {
  const { user } = await requireTimetableAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
  ]);
  const schoolId = user.schoolId;

  const parsed = periodSettingsSchema.safeParse(periodsData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }
  const incoming = parsed.data;

  const byStart = [...incoming].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  for (const [i, p] of byStart.entries()) {
    if (p.endTime <= p.startTime) {
      return { success: false, error: `${p.name} must end after it starts` };
    }
    const next = byStart[i + 1];
    if (next && next.startTime < p.endTime) {
      return {
        success: false,
        error: `${p.name} (${p.startTime}–${p.endTime}) overlaps ${next.name} (${next.startTime}–${next.endTime})`,
      };
    }
  }

  const existing = await prisma.timetablePeriod.findMany({
    where: { schoolId },
    select: { id: true, startTime: true, endTime: true },
  });
  const existingById = new Map(existing.map((p) => [p.id, p]));
  if (incoming.some((p) => p.id && !existingById.has(p.id))) {
    return {
      success: false,
      error:
        "The periods changed while you were editing. Reload and try again.",
    };
  }
  const keptIds = new Set(incoming.map((p) => p.id).filter(Boolean));
  const removed = existing.filter((p) => !keptIds.has(p.id));

  // Classes scheduled in removed periods, matched by period or, for classes
  // saved before periods were linked, by start time.
  const affectedClasses =
    removed.length > 0
      ? await prisma.timetableSlot.count({
          where: {
            schoolId,
            OR: [
              { periodId: { in: removed.map((p) => p.id) } },
              {
                periodId: null,
                startTime: { in: removed.map((p) => p.startTime) },
              },
            ],
          },
        })
      : 0;
  if (affectedClasses > 0 && !options.removeScheduledClasses) {
    return {
      success: false,
      code: "PERIOD_HAS_CLASSES",
      affectedClasses,
      error: `${affectedClasses} scheduled class${affectedClasses === 1 ? " is" : "es are"} in the periods you removed. Saving will delete ${affectedClasses === 1 ? "it" : "them"} from the timetable.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Link classes saved before periods were linked, by start time.
      for (const p of existing) {
        await tx.timetableSlot.updateMany({
          where: { schoolId, periodId: null, startTime: p.startTime },
          data: { periodId: p.id },
        });
      }

      // 2. Remove dropped periods and (confirmed above) their classes.
      if (removed.length > 0) {
        await tx.timetableSlot.deleteMany({
          where: { schoolId, periodId: { in: removed.map((p) => p.id) } },
        });
        await tx.timetablePeriod.deleteMany({
          where: { id: { in: removed.map((p) => p.id) } },
        });
      }

      // 3. Move retimed periods and their classes. Two steps, through a
      //    temporary start time, so swapping two periods' times can't hit
      //    the unique start-time constraints halfway through.
      const retimed = incoming.filter((p) => {
        const before = p.id ? existingById.get(p.id) : undefined;
        return before && before.startTime !== p.startTime;
      });
      for (const p of retimed) {
        await tx.timetablePeriod.update({
          where: { id: p.id },
          data: { startTime: `~${p.id}` },
        });
        await tx.timetableSlot.updateMany({
          where: { schoolId, periodId: p.id },
          data: { startTime: `~${p.id}` },
        });
      }

      for (const p of incoming) {
        const periodData = {
          name: p.name,
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          isBreak: p.isBreak,
        };
        if (p.id) {
          await tx.timetablePeriod.update({
            where: { id: p.id },
            data: periodData,
          });
          const before = existingById.get(p.id)!;
          if (
            before.startTime !== p.startTime ||
            before.endTime !== p.endTime
          ) {
            await tx.timetableSlot.updateMany({
              where: { schoolId, periodId: p.id },
              data: { startTime: p.startTime, endTime: p.endTime },
            });
          }
        } else {
          await tx.timetablePeriod.create({
            data: { ...periodData, schoolId },
          });
        }
      }
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return {
        success: false,
        error:
          "Some classes are scheduled at a time that no longer matches a period. Clear them from the timetable and try again.",
      };
    }
    throw e;
  }

  revalidatePath("/timetable");
  return { success: true, removedClasses: affectedClasses };
}

export async function getTimetable(filter: {
  classId?: string;
  sectionId?: string;
  teacherId?: string;
  academicYear?: string;
}) {
  const { user } = await requireTimetableAccess();
  const schoolId = user.schoolId;

  const where: any = { schoolId };
  if (filter.classId) where.classId = filter.classId;
  if (filter.sectionId) where.sectionId = filter.sectionId;
  if (filter.teacherId) where.teacherId = filter.teacherId;
  if (filter.academicYear) where.academicYear = filter.academicYear;

  const slots = await prisma.timetableSlot.findMany({
    where,
    include: {
      class: { select: { id: true, name: true, grade: true } },
      section: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, email: true, subject: true } },
      period: {
        select: { id: true, name: true, periodNumber: true, isBreak: true },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return slots;
}

export async function checkSlotConflict(data: {
  classId: string;
  sectionId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId?: string | null;
  room?: string | null;
  excludeSlotId?: string;
}) {
  const { user } = await requireTimetableAccess();
  const schoolId = user.schoolId;

  // Query all slots for this day and startTime in the school
  const clashingSlots = await prisma.timetableSlot.findMany({
    where: {
      schoolId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      ...(data.excludeSlotId ? { id: { not: data.excludeSlotId } } : {}),
    },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      teacher: { select: { name: true } },
    },
  });

  const existingSlots: ExistingSlot[] = clashingSlots.map((s) => ({
    id: s.id,
    classId: s.classId,
    sectionId: s.sectionId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subjectName: s.subjectName,
    teacherId: s.teacherId,
    teacherName: s.teacher?.name,
    room: s.room,
  }));

  return detectManualConflict({
    schoolId,
    targetClassId: data.classId,
    targetSectionId: data.sectionId,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
    teacherId: data.teacherId,
    room: data.room,
    excludeSlotId: data.excludeSlotId,
    existingSlots,
  });
}

export async function saveTimetableSlot(rawData: z.infer<typeof slotSchema>) {
  const { user } = await requireTimetableAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
  ]);
  const schoolId = user.schoolId;
  const data = slotSchema.parse(rawData);

  // Validate class belongs to school
  const classObj = await prisma.class.findFirst({
    where: { id: data.classId, schoolId },
  });
  if (!classObj) {
    return { success: false, error: "Class not found in your school" };
  }

  // Validate section belongs to school and class
  const sectionObj = await prisma.section.findFirst({
    where: { id: data.sectionId, classId: data.classId, schoolId },
  });
  if (!sectionObj) {
    return { success: false, error: "Section not found for this class" };
  }

  // Validate teacher belongs to school if provided
  if (data.teacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: data.teacherId, schoolId },
    });
    if (!teacher) {
      return { success: false, error: "Teacher not found in your school" };
    }
  }

  // Validate period if provided
  let periodId = data.periodId;
  if (periodId) {
    const period = await prisma.timetablePeriod.findFirst({
      where: { id: periodId, schoolId },
    });
    if (!period) {
      return { success: false, error: "Period not found in your school" };
    }
  } else {
    const period = await prisma.timetablePeriod.findFirst({
      where: { schoolId, startTime: data.startTime },
    });
    if (period) periodId = period.id;
  }

  // Validate conflicts
  const conflictCheck = await checkSlotConflict({
    classId: data.classId,
    sectionId: data.sectionId,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
    teacherId: data.teacherId,
    room: data.room,
    excludeSlotId: data.id,
  });

  if (conflictCheck.hasConflict) {
    return {
      success: false,
      error: conflictCheck.message,
      conflictType: conflictCheck.conflictType,
    };
  }

  const slotData = {
    classId: data.classId,
    sectionId: data.sectionId,
    teacherId: data.teacherId || null,
    periodId: periodId || null,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
    subjectName: data.subjectName,
    room: data.room || null,
    academicYear: data.academicYear || null,
  };

  // D8: an edit updates the slot it came from, so moving it to another day
  // or time moves it instead of leaving a copy behind.
  let slot;
  try {
    if (data.id) {
      const existing = await prisma.timetableSlot.findFirst({
        where: { id: data.id, schoolId },
        select: { id: true },
      });
      if (!existing) {
        return { success: false, error: "Timetable slot not found" };
      }
      slot = await prisma.timetableSlot.update({
        where: { id: existing.id },
        data: slotData,
      });
    } else {
      slot = await prisma.timetableSlot.create({
        data: { ...slotData, schoolId },
      });
    }
  } catch (e: any) {
    if (e?.code === "P2002") {
      return {
        success: false,
        error: "This section already has a class at that day and time",
        conflictType: "SECTION" as const,
      };
    }
    throw e;
  }

  revalidatePath("/timetable");
  return { success: true, slot };
}

export async function deleteTimetableSlot(slotId: string) {
  const { user } = await requireTimetableAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
  ]);
  const schoolId = user.schoolId;

  await prisma.timetableSlot.deleteMany({
    where: { id: slotId, schoolId },
  });

  revalidatePath("/timetable");
  return { success: true };
}

export async function clearSectionTimetable(sectionId: string) {
  const { user } = await requireTimetableAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
  ]);
  const schoolId = user.schoolId;

  const deleted = await prisma.timetableSlot.deleteMany({
    where: { schoolId, sectionId },
  });

  revalidatePath("/timetable");
  return { success: true, count: deleted.count };
}

export async function generateAutomatedTimetableAction(params: {
  classId: string;
  sectionId: string;
  daysOfWeek?: number[];
  subjects: SubjectQuota[];
  replaceExisting?: boolean;
  academicYear?: string;
}) {
  const { user } = await requireTimetableAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
  ]);
  const schoolId = user.schoolId;

  const classObj = await prisma.class.findFirst({
    where: { id: params.classId, schoolId },
  });
  if (!classObj) throw new Error("Class not found in your school");

  const sectionObj = await prisma.section.findFirst({
    where: { id: params.sectionId, classId: params.classId, schoolId },
  });
  if (!sectionObj) throw new Error("Section not found for this class");

  const daysOfWeek = params.daysOfWeek || [1, 2, 3, 4, 5, 6];

  const [periods, allSchoolSlots, sectionSlots, schoolTeachers] =
    await Promise.all([
      getTimetablePeriods(),
      prisma.timetableSlot.findMany({
        where: { schoolId, sectionId: { not: params.sectionId } },
        include: { teacher: { select: { name: true } } },
      }),
      prisma.timetableSlot.findMany({
        where: { schoolId, sectionId: params.sectionId },
        include: { teacher: { select: { name: true } } },
      }),
      prisma.teacher.findMany({
        where: { schoolId },
        select: { id: true },
      }),
    ]);

  const validTeacherIds = new Set(schoolTeachers.map((t) => t.id));

  const existingLockedSlots: ExistingSlot[] = params.replaceExisting
    ? []
    : sectionSlots.map((s) => ({
        id: s.id,
        classId: s.classId,
        sectionId: s.sectionId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectName: s.subjectName,
        teacherId: s.teacherId,
        teacherName: s.teacher?.name,
        room: s.room,
      }));

  const otherSectionSlots: ExistingSlot[] = allSchoolSlots.map((s) => ({
    id: s.id,
    classId: s.classId,
    sectionId: s.sectionId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subjectName: s.subjectName,
    teacherId: s.teacherId,
    teacherName: s.teacher?.name,
    room: s.room,
  }));

  const periodDefs: PeriodDefinition[] = periods.map((p) => ({
    id: p.id,
    periodNumber: p.periodNumber,
    name: p.name,
    startTime: p.startTime,
    endTime: p.endTime,
    isBreak: p.isBreak,
  }));

  const result = generateTimetable({
    schoolId,
    classId: params.classId,
    sectionId: params.sectionId,
    daysOfWeek,
    periods: periodDefs,
    subjects: params.subjects,
    existingLockedSlots,
    otherSectionSlots,
  });

  if (!result.success && result.allocatedSlots === 0) {
    return {
      success: false,
      diagnostics: result.diagnostics,
      unassignedSubjects: result.unassignedSubjects,
    };
  }

  // Persist slots in database using single fast round-trip
  const recordsToCreate = result.slots
    .filter((slot) => !slot.isLocked)
    .map((slot) => {
      const matchingPeriod = periods.find(
        (p) => p.startTime === slot.startTime,
      );
      const safeTeacherId =
        slot.teacherId && validTeacherIds.has(slot.teacherId)
          ? slot.teacherId
          : null;

      return {
        schoolId,
        classId: params.classId,
        sectionId: params.sectionId,
        teacherId: safeTeacherId,
        periodId: matchingPeriod?.id || null,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectName: slot.subjectName,
        room: slot.room || null,
        academicYear: params.academicYear || null,
      };
    });

  // D9: replace atomically, so a failed insert can't leave the section with
  // no timetable at all.
  await prisma.$transaction(async (tx) => {
    if (params.replaceExisting) {
      await tx.timetableSlot.deleteMany({
        where: { schoolId, sectionId: params.sectionId },
      });
    }
    if (recordsToCreate.length > 0) {
      await tx.timetableSlot.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/timetable");

  return {
    success: result.success,
    allocatedSlots: result.allocatedSlots,
    totalSlots: result.totalSlots,
    unassignedSubjects: result.unassignedSubjects,
    diagnostics: result.diagnostics,
  };
}

export async function generateAiTimetableAction(params: {
  classId: string;
  sectionId: string;
  daysOfWeek?: number[];
  subjects: SubjectQuota[];
  replaceExisting?: boolean;
  academicYear?: string;
  customPrompt?: string;
}) {
  const { user } = await requireTimetableAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
  ]);
  const schoolId = user.schoolId;
  checkAiRateLimit(schoolId);
  const daysOfWeek = params.daysOfWeek || [1, 2, 3, 4, 5, 6];

  const [
    targetClass,
    targetSection,
    periods,
    allSchoolSlots,
    sectionSlots,
    schoolTeachers,
  ] = await Promise.all([
    prisma.class.findUnique({
      where: { id: params.classId, schoolId },
      select: { name: true },
    }),
    prisma.section.findUnique({
      where: { id: params.sectionId, schoolId },
      select: { name: true },
    }),
    getTimetablePeriods(),
    prisma.timetableSlot.findMany({
      where: { schoolId, sectionId: { not: params.sectionId } },
      include: { teacher: { select: { name: true } } },
    }),
    prisma.timetableSlot.findMany({
      where: { schoolId, sectionId: params.sectionId },
      include: { teacher: { select: { name: true } } },
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true },
    }),
  ]);

  const validTeacherIds = new Set(schoolTeachers.map((t) => t.id));

  if (!targetClass || !targetSection) {
    throw new Error("Target class or section not found");
  }

  const existingLockedSlots: ExistingSlot[] = params.replaceExisting
    ? []
    : sectionSlots.map((s) => ({
        id: s.id,
        classId: s.classId,
        sectionId: s.sectionId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectName: s.subjectName,
        teacherId: s.teacherId,
        teacherName: s.teacher?.name,
        room: s.room,
      }));

  const otherSectionSlots: ExistingSlot[] = allSchoolSlots.map((s) => ({
    id: s.id,
    classId: s.classId,
    sectionId: s.sectionId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subjectName: s.subjectName,
    teacherId: s.teacherId,
    teacherName: s.teacher?.name,
    room: s.room,
  }));

  const periodDefs: PeriodDefinition[] = periods.map((p) => ({
    id: p.id,
    periodNumber: p.periodNumber,
    name: p.name,
    startTime: p.startTime,
    endTime: p.endTime,
    isBreak: p.isBreak,
  }));

  const teacherCommitments = allSchoolSlots
    .filter((s) => s.teacherId)
    .map((s) => ({
      teacherId: s.teacherId!,
      teacherName: s.teacher?.name,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      busyWith: `${s.subjectName}`,
    }));

  // 1. Generate smart schedule draft with Gemini with automatic fallback
  let aiDraft: AiTimetableResponse | null = null;
  let usedFallbackSolver = false;
  let aiErrorMessage = "";

  try {
    aiDraft = await generateAiScheduleDraft({
      className: targetClass.name,
      sectionName: targetSection.name,
      daysOfWeek,
      periods: periodDefs,
      subjects: params.subjects,
      teacherCommitments,
      customPrompt: params.customPrompt,
    });
  } catch (err: any) {
    logger.warn({
      msg: "Gemini API unavailable or busy, falling back to Kora deterministic solver",
      error: err.message,
    });
    usedFallbackSolver = true;
    aiErrorMessage = err.message || "Gemini AI temporarily busy";
  }

  // 2. Validate against Kora strict deterministic conflict engine for zero-clash guarantee
  let result;
  let rationale = "";

  if (aiDraft) {
    result = validateAndRefineAiTimetable({
      input: {
        schoolId,
        classId: params.classId,
        sectionId: params.sectionId,
        daysOfWeek,
        periods: periodDefs,
        subjects: params.subjects,
        existingLockedSlots,
        otherSectionSlots,
      },
      aiSlots: aiDraft.slots,
    });
    rationale = aiDraft.rationale;
  } else {
    result = generateTimetable({
      schoolId,
      classId: params.classId,
      sectionId: params.sectionId,
      daysOfWeek,
      periods: periodDefs,
      subjects: params.subjects,
      existingLockedSlots,
      otherSectionSlots,
    });
    rationale = `Generated via Kora Conflict-Free Engine (Gemini AI was temporarily experiencing high demand). All teacher & room clashes prevented.`;
    result.diagnostics = [
      `Gemini AI was busy; seamlessly switched to Kora Conflict-Free Solver.`,
      ...result.diagnostics,
    ];
  }

  if (!result.success && result.allocatedSlots === 0) {
    return {
      success: false,
      diagnostics: result.diagnostics,
      unassignedSubjects: result.unassignedSubjects,
      aiRationale: rationale,
      usedFallbackSolver,
    };
  }

  // 3. Persist clash-free slots in database
  const recordsToCreate = result.slots
    .filter((slot) => !slot.isLocked)
    .map((slot) => {
      const matchingPeriod = periods.find(
        (p) => p.startTime === slot.startTime,
      );
      const safeTeacherId =
        slot.teacherId && validTeacherIds.has(slot.teacherId)
          ? slot.teacherId
          : null;

      return {
        schoolId,
        classId: params.classId,
        sectionId: params.sectionId,
        teacherId: safeTeacherId,
        periodId: matchingPeriod?.id || null,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectName: slot.subjectName,
        room: slot.room || null,
        academicYear: params.academicYear || null,
      };
    });

  // D9: replace atomically, so a failed insert can't leave the section with
  // no timetable at all.
  await prisma.$transaction(async (tx) => {
    if (params.replaceExisting) {
      await tx.timetableSlot.deleteMany({
        where: { schoolId, sectionId: params.sectionId },
      });
    }
    if (recordsToCreate.length > 0) {
      await tx.timetableSlot.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/timetable");

  return {
    success: result.success,
    allocatedSlots: result.allocatedSlots,
    totalSlots: result.totalSlots,
    unassignedSubjects: result.unassignedSubjects,
    diagnostics: result.diagnostics,
    aiRationale: rationale,
    usedFallbackSolver,
  };
}

export interface ConflictItem {
  id: string;
  type: "TEACHER" | "ROOM" | "SECTION";
  title: string;
  description: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slots: any[];
}

export async function auditSchoolConflicts(): Promise<ConflictItem[]> {
  const { user } = await requireTimetableAccess();
  const schoolId = user.schoolId;

  const allSlots = await prisma.timetableSlot.findMany({
    where: { schoolId },
    include: {
      class: { select: { id: true, name: true, grade: true } },
      section: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, subject: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const conflicts: ConflictItem[] = [];

  // Group by (dayOfWeek, startTime)
  const timeSlotMap = new Map<string, typeof allSlots>();
  for (const s of allSlots) {
    const key = `${s.dayOfWeek}_${s.startTime}`;
    if (!timeSlotMap.has(key)) {
      timeSlotMap.set(key, []);
    }
    timeSlotMap.get(key)!.push(s);
  }

  for (const [, slotsInTime] of timeSlotMap.entries()) {
    if (slotsInTime.length < 2) continue;

    // 1. Teacher clashes
    const teacherMap = new Map<string, typeof allSlots>();
    for (const s of slotsInTime) {
      if (!s.teacherId) continue;
      if (!teacherMap.has(s.teacherId)) teacherMap.set(s.teacherId, []);
      teacherMap.get(s.teacherId)!.push(s);
    }
    for (const [teacherId, clashing] of teacherMap.entries()) {
      if (clashing.length > 1) {
        const teacherName = clashing[0].teacher?.name || "Teacher";
        conflicts.push({
          id: `teacher_${teacherId}_${clashing[0].dayOfWeek}_${clashing[0].startTime}`,
          type: "TEACHER",
          title: `Teacher Double-Booking: ${teacherName}`,
          description: `${teacherName} is scheduled simultaneously in ${clashing.map((c) => `${c.class.name} (${c.section.name}) - ${c.subjectName}`).join(" and ")}.`,
          dayOfWeek: clashing[0].dayOfWeek,
          startTime: clashing[0].startTime,
          endTime: clashing[0].endTime,
          slots: clashing,
        });
      }
    }

    // 2. Room clashes
    const roomMap = new Map<string, typeof allSlots>();
    for (const s of slotsInTime) {
      if (!s.room || !s.room.trim()) continue;
      const roomKey = s.room.trim().toLowerCase();
      if (!roomMap.has(roomKey)) roomMap.set(roomKey, []);
      roomMap.get(roomKey)!.push(s);
    }
    for (const [, clashing] of roomMap.entries()) {
      if (clashing.length > 1) {
        const roomName = clashing[0].room;
        conflicts.push({
          id: `room_${roomName}_${clashing[0].dayOfWeek}_${clashing[0].startTime}`,
          type: "ROOM",
          title: `Room Double-Booking: ${roomName}`,
          description: `Venue "${roomName}" is booked simultaneously by ${clashing.map((c) => `${c.class.name} (${c.section.name})`).join(" and ")}.`,
          dayOfWeek: clashing[0].dayOfWeek,
          startTime: clashing[0].startTime,
          endTime: clashing[0].endTime,
          slots: clashing,
        });
      }
    }
  }

  return conflicts;
}
