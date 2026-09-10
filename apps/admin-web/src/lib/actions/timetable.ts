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

export async function getTimetablePeriods() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

  let periods = await prisma.timetablePeriod.findMany({
    where: { schoolId },
    orderBy: [{ periodNumber: "asc" }, { startTime: "asc" }],
  });

  // If none configured yet, seed the default periods for this school
  if (periods.length === 0) {
    await prisma.$transaction(
      DEFAULT_PERIODS.map((dp) =>
        prisma.timetablePeriod.create({
          data: {
            schoolId,
            periodNumber: dp.periodNumber,
            name: dp.name,
            startTime: dp.startTime,
            endTime: dp.endTime,
            isBreak: dp.isBreak,
          },
        }),
      ),
    );

    periods = await prisma.timetablePeriod.findMany({
      where: { schoolId },
      orderBy: [{ periodNumber: "asc" }, { startTime: "asc" }],
    });
  }

  return periods;
}

export async function savePeriodSettings(
  periodsData: Array<{
    id?: string;
    name: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    isBreak: boolean;
  }>,
) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

  await prisma.$transaction(async (tx) => {
    // Delete existing periods and recreate them
    await tx.timetablePeriod.deleteMany({
      where: { schoolId },
    });

    for (const p of periodsData) {
      await tx.timetablePeriod.create({
        data: {
          schoolId,
          name: p.name,
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          isBreak: p.isBreak,
        },
      });
    }
  });

  revalidatePath("/timetable");
  return { success: true };
}

export async function getTimetable(filter: {
  classId?: string;
  sectionId?: string;
  teacherId?: string;
  academicYear?: string;
}) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

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
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

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
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;
  const data = slotSchema.parse(rawData);

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

  // Find matching period if not provided
  let periodId = data.periodId;
  if (!periodId) {
    const period = await prisma.timetablePeriod.findFirst({
      where: { schoolId, startTime: data.startTime },
    });
    if (period) periodId = period.id;
  }

  const slot = await prisma.timetableSlot.upsert({
    where: {
      schoolId_sectionId_dayOfWeek_startTime: {
        schoolId,
        sectionId: data.sectionId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
      },
    },
    create: {
      schoolId,
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
    },
    update: {
      classId: data.classId,
      teacherId: data.teacherId || null,
      periodId: periodId || null,
      endTime: data.endTime,
      subjectName: data.subjectName,
      room: data.room || null,
      academicYear: data.academicYear || null,
    },
  });

  revalidatePath("/timetable");
  return { success: true, slot };
}

export async function deleteTimetableSlot(slotId: string) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

  await prisma.timetableSlot.deleteMany({
    where: { id: slotId, schoolId },
  });

  revalidatePath("/timetable");
  return { success: true };
}

export async function clearSectionTimetable(sectionId: string) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

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
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;
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
  if (params.replaceExisting) {
    await prisma.timetableSlot.deleteMany({
      where: { schoolId, sectionId: params.sectionId },
    });
  }

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

  if (recordsToCreate.length > 0) {
    await prisma.timetableSlot.createMany({
      data: recordsToCreate,
      skipDuplicates: true,
    });
  }

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
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;
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
  if (params.replaceExisting) {
    await prisma.timetableSlot.deleteMany({
      where: { schoolId, sectionId: params.sectionId },
    });
  }

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

  if (recordsToCreate.length > 0) {
    await prisma.timetableSlot.createMany({
      data: recordsToCreate,
      skipDuplicates: true,
    });
  }

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
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const schoolId = session.user.schoolId;

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
