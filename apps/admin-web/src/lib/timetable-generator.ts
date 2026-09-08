/**
 * Heuristic Constraint-Satisfaction Timetable Generator
 *
 * Generates clash-free weekly class schedules considering:
 * - Teacher availability across the entire school
 * - Room / lab availability
 * - Balanced subject distribution across days (avoiding clustering)
 * - Support for pre-existing locked slots
 */

export interface PeriodDefinition {
  id?: string;
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface SubjectQuota {
  subjectName: string;
  periodsPerWeek: number;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
  maxPerDay?: number;
}

export interface ExistingSlot {
  id?: string;
  classId: string;
  sectionId: string;
  dayOfWeek: number; // 1 = Mon ... 6 = Sat
  startTime: string;
  endTime: string;
  periodNumber?: number;
  subjectName: string;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
}

export interface GeneratorInput {
  schoolId: string;
  classId: string;
  sectionId: string;
  daysOfWeek: number[]; // e.g. [1, 2, 3, 4, 5, 6]
  periods: PeriodDefinition[];
  subjects: SubjectQuota[];
  existingLockedSlots?: ExistingSlot[];
  otherSectionSlots?: ExistingSlot[];
}

export interface GeneratedSlot {
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
  isLocked?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  slots: GeneratedSlot[];
  unassignedSubjects: {
    subjectName: string;
    remaining: number;
    reason: string;
  }[];
  totalSlots: number;
  allocatedSlots: number;
  diagnostics: string[];
}

export const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const DEFAULT_PERIODS: PeriodDefinition[] = [
  {
    periodNumber: 1,
    name: "Period 1",
    startTime: "08:00",
    endTime: "08:45",
    isBreak: false,
  },
  {
    periodNumber: 2,
    name: "Period 2",
    startTime: "08:45",
    endTime: "09:30",
    isBreak: false,
  },
  {
    periodNumber: 3,
    name: "Period 3",
    startTime: "09:30",
    endTime: "10:15",
    isBreak: false,
  },
  {
    periodNumber: 4,
    name: "Recess",
    startTime: "10:15",
    endTime: "10:35",
    isBreak: true,
  },
  {
    periodNumber: 5,
    name: "Period 4",
    startTime: "10:35",
    endTime: "11:20",
    isBreak: false,
  },
  {
    periodNumber: 6,
    name: "Period 5",
    startTime: "11:20",
    endTime: "12:05",
    isBreak: false,
  },
  {
    periodNumber: 7,
    name: "Lunch",
    startTime: "12:05",
    endTime: "12:45",
    isBreak: true,
  },
  {
    periodNumber: 8,
    name: "Period 6",
    startTime: "12:45",
    endTime: "01:30",
    isBreak: false,
  },
  {
    periodNumber: 9,
    name: "Period 7",
    startTime: "01:30",
    endTime: "02:15",
    isBreak: false,
  },
  {
    periodNumber: 10,
    name: "Period 8",
    startTime: "02:15",
    endTime: "03:00",
    isBreak: false,
  },
];

/**
 * Solves and generates a timetable using constraint propagation & heuristic backtracking.
 */
export function generateTimetable(input: GeneratorInput): GeneratorResult {
  const {
    daysOfWeek,
    periods,
    subjects,
    existingLockedSlots = [],
    otherSectionSlots = [],
  } = input;

  const teachablePeriods = periods.filter((p) => !p.isBreak);
  const diagnostics: string[] = [];
  const unassignedSubjects: {
    subjectName: string;
    remaining: number;
    reason: string;
  }[] = [];

  // Map of teacher occupation: `${teacherId}_${dayOfWeek}_${startTime}` => info
  const teacherBusyMap = new Map<string, string>();
  // Map of room occupation: `${room.toLowerCase()}_${dayOfWeek}_${startTime}` => info
  const roomBusyMap = new Map<string, string>();

  // Populate busy maps from other sections in the school
  for (const s of otherSectionSlots) {
    if (s.teacherId) {
      teacherBusyMap.set(
        `${s.teacherId}_${s.dayOfWeek}_${s.startTime}`,
        `Booked in other class (${s.subjectName})`,
      );
    }
    if (s.room && s.room.trim()) {
      roomBusyMap.set(
        `${s.room.trim().toLowerCase()}_${s.dayOfWeek}_${s.startTime}`,
        `Booked in other class (${s.subjectName})`,
      );
    }
  }

  // Grid state: key = `${dayOfWeek}_${periodNumber}`
  const grid = new Map<string, GeneratedSlot>();

  // Lock existing slots in this section
  for (const locked of existingLockedSlots) {
    const period = teachablePeriods.find(
      (p) => p.startTime === locked.startTime,
    ) || {
      periodNumber: locked.periodNumber || 1,
      name: `Period ${locked.periodNumber || 1}`,
      startTime: locked.startTime,
      endTime: locked.endTime,
      isBreak: false,
    };

    const slotKey = `${locked.dayOfWeek}_${period.periodNumber}`;
    const generated: GeneratedSlot = {
      dayOfWeek: locked.dayOfWeek,
      periodNumber: period.periodNumber,
      startTime: locked.startTime,
      endTime: locked.endTime,
      subjectName: locked.subjectName,
      teacherId: locked.teacherId,
      teacherName: locked.teacherName,
      room: locked.room,
      isLocked: true,
    };
    grid.set(slotKey, generated);

    if (locked.teacherId) {
      teacherBusyMap.set(
        `${locked.teacherId}_${locked.dayOfWeek}_${locked.startTime}`,
        `Locked in this section`,
      );
    }
    if (locked.room && locked.room.trim()) {
      roomBusyMap.set(
        `${locked.room.trim().toLowerCase()}_${locked.dayOfWeek}_${locked.startTime}`,
        `Locked in this section`,
      );
    }
  }

  // Calculate remaining slots
  const allAvailableSlotCoords: {
    dayOfWeek: number;
    period: PeriodDefinition;
  }[] = [];
  for (const day of daysOfWeek) {
    for (const period of teachablePeriods) {
      const key = `${day}_${period.periodNumber}`;
      if (!grid.has(key)) {
        allAvailableSlotCoords.push({ dayOfWeek: day, period });
      }
    }
  }

  const totalAvailable =
    allAvailableSlotCoords.length + existingLockedSlots.length;
  const totalRequested = subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);

  if (totalRequested > totalAvailable) {
    diagnostics.push(
      `Warning: Requested ${totalRequested} periods, but only ${totalAvailable} slots are available in the week.`,
    );
  }

  // Expand subjects into units to place
  interface SubjectUnit {
    subjectName: string;
    teacherId?: string | null;
    teacherName?: string | null;
    room?: string | null;
    maxPerDay: number;
  }

  const unitsToPlace: SubjectUnit[] = [];

  // Sort subjects by constraint tightness (teacher assigned + lab room > teacher assigned > unassigned; then quota desc)
  const sortedSubjects = [...subjects].sort((a, b) => {
    const weightA =
      (a.teacherId ? 2 : 0) + (a.room ? 2 : 0) + a.periodsPerWeek * 0.1;
    const weightB =
      (b.teacherId ? 2 : 0) + (b.room ? 2 : 0) + b.periodsPerWeek * 0.1;
    return weightB - weightA;
  });

  for (const s of sortedSubjects) {
    // Subtract any already placed locked slots for this subject
    const alreadyPlaced = existingLockedSlots.filter(
      (ls) => ls.subjectName.toLowerCase() === s.subjectName.toLowerCase(),
    ).length;
    const needed = Math.max(0, s.periodsPerWeek - alreadyPlaced);
    const maxPerDay =
      s.maxPerDay ?? (s.periodsPerWeek > daysOfWeek.length ? 2 : 1);

    for (let i = 0; i < needed; i++) {
      unitsToPlace.push({
        subjectName: s.subjectName,
        teacherId: s.teacherId,
        teacherName: s.teacherName,
        room: s.room,
        maxPerDay,
      });
    }
  }

  // Count placements per subject per day
  const dailySubjectCount = new Map<string, number>(); // `${dayOfWeek}_${subjectName.toLowerCase()}` => count
  for (const locked of existingLockedSlots) {
    const key = `${locked.dayOfWeek}_${locked.subjectName.toLowerCase()}`;
    dailySubjectCount.set(key, (dailySubjectCount.get(key) || 0) + 1);
  }

  // Place each unit using greedy heuristic with day spreading
  for (const unit of unitsToPlace) {
    let placed = false;

    // Score available slots: prefer days with 0 instances of this subject, then period variety
    const scoredSlots = allAvailableSlotCoords
      .filter(
        (coord) => !grid.has(`${coord.dayOfWeek}_${coord.period.periodNumber}`),
      )
      .map((coord) => {
        const daySubjectKey = `${coord.dayOfWeek}_${unit.subjectName.toLowerCase()}`;
        const currentInDay = dailySubjectCount.get(daySubjectKey) || 0;

        // Check hard constraints
        let penalty = 0;
        if (currentInDay >= unit.maxPerDay) {
          penalty += 1000; // Violates max per day
        }

        if (unit.teacherId) {
          const tKey = `${unit.teacherId}_${coord.dayOfWeek}_${coord.period.startTime}`;
          if (teacherBusyMap.has(tKey)) {
            penalty += 10000; // Teacher clash!
          }
        }

        if (unit.room && unit.room.trim()) {
          const rKey = `${unit.room.trim().toLowerCase()}_${coord.dayOfWeek}_${coord.period.startTime}`;
          if (roomBusyMap.has(rKey)) {
            penalty += 10000; // Room clash!
          }
        }

        // Soft score: spread across days evenly
        const score =
          penalty + currentInDay * 10 + (coord.period.periodNumber % 2);

        return { coord, score, penalty };
      })
      .sort((a, b) => a.score - b.score);

    // Pick the best valid slot (penalty < 1000)
    const best = scoredSlots.find((s) => s.penalty < 1000);

    if (best) {
      const { coord } = best;
      const key = `${coord.dayOfWeek}_${coord.period.periodNumber}`;
      const generated: GeneratedSlot = {
        dayOfWeek: coord.dayOfWeek,
        periodNumber: coord.period.periodNumber,
        startTime: coord.period.startTime,
        endTime: coord.period.endTime,
        subjectName: unit.subjectName,
        teacherId: unit.teacherId,
        teacherName: unit.teacherName,
        room: unit.room,
        isLocked: false,
      };

      grid.set(key, generated);

      if (unit.teacherId) {
        teacherBusyMap.set(
          `${unit.teacherId}_${coord.dayOfWeek}_${coord.period.startTime}`,
          `Assigned to this class`,
        );
      }
      if (unit.room && unit.room.trim()) {
        roomBusyMap.set(
          `${unit.room.trim().toLowerCase()}_${coord.dayOfWeek}_${coord.period.startTime}`,
          `Assigned to this class`,
        );
      }

      const daySubjectKey = `${coord.dayOfWeek}_${unit.subjectName.toLowerCase()}`;
      dailySubjectCount.set(
        daySubjectKey,
        (dailySubjectCount.get(daySubjectKey) || 0) + 1,
      );
      placed = true;
    } else {
      // Could not place without clash or quota violation
      const existing = unassignedSubjects.find(
        (u) => u.subjectName === unit.subjectName,
      );
      if (existing) {
        existing.remaining += 1;
      } else {
        const reason =
          unit.teacherId && scoredSlots.some((s) => s.penalty >= 10000)
            ? `Teacher conflict in other classes during remaining free slots.`
            : `No remaining slots within daily maximum limit.`;
        unassignedSubjects.push({
          subjectName: unit.subjectName,
          remaining: 1,
          reason,
        });
      }
    }
  }

  const resultSlots = Array.from(grid.values()).sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.periodNumber - b.periodNumber;
  });

  const unassignedCount = unassignedSubjects.reduce(
    (sum, u) => sum + u.remaining,
    0,
  );

  return {
    success: unassignedCount === 0,
    slots: resultSlots,
    unassignedSubjects,
    totalSlots: daysOfWeek.length * teachablePeriods.length,
    allocatedSlots: resultSlots.length,
    diagnostics,
  };
}

/**
 * Checks for a specific conflict when manually saving or moving a slot.
 */
export function detectManualConflict(params: {
  schoolId: string;
  targetClassId: string;
  targetSectionId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId?: string | null;
  room?: string | null;
  excludeSlotId?: string;
  existingSlots: ExistingSlot[];
}): {
  hasConflict: boolean;
  message?: string;
  conflictType?: "TEACHER" | "ROOM" | "SECTION";
} {
  const {
    targetClassId,
    targetSectionId,
    dayOfWeek,
    startTime,
    teacherId,
    room,
    excludeSlotId,
    existingSlots,
  } = params;

  for (const slot of existingSlots) {
    if (excludeSlotId && slot.id === excludeSlotId) continue;
    if (slot.dayOfWeek !== dayOfWeek) continue;
    if (slot.startTime !== startTime) continue;

    // 1. Check Section Clash
    if (slot.sectionId === targetSectionId) {
      return {
        hasConflict: true,
        conflictType: "SECTION",
        message: `This section already has ${slot.subjectName} scheduled on ${DAY_NAMES[dayOfWeek]} at ${startTime}.`,
      };
    }

    // 2. Check Teacher Clash
    if (teacherId && slot.teacherId && slot.teacherId === teacherId) {
      const teacherName = slot.teacherName || "The selected teacher";
      return {
        hasConflict: true,
        conflictType: "TEACHER",
        message: `${teacherName} is already teaching ${slot.subjectName} in another class at this time (${DAY_NAMES[dayOfWeek]}, ${startTime} - ${slot.endTime}).`,
      };
    }

    // 3. Check Room Clash
    if (
      room &&
      room.trim() &&
      slot.room &&
      slot.room.trim().toLowerCase() === room.trim().toLowerCase()
    ) {
      return {
        hasConflict: true,
        conflictType: "ROOM",
        message: `Room "${room.trim()}" is already booked for ${slot.subjectName} at this time (${DAY_NAMES[dayOfWeek]}, ${startTime} - ${slot.endTime}).`,
      };
    }
  }

  return { hasConflict: false };
}

export interface AiDraftInputSlot {
  dayOfWeek: number;
  periodNumber?: number;
  startTime?: string;
  endTime?: string;
  subjectName: string;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
}

/**
 * Validates Gemini AI's draft timetable against all hard constraints (teacher/room conflicts,
 * breaks, section overlaps). If any clashes or missing slots occur, automatically refines
 * and resolves them using the deterministic placement engine for a 100% conflict-free guarantee.
 */
export function validateAndRefineAiTimetable(params: {
  input: GeneratorInput;
  aiSlots: AiDraftInputSlot[];
}): GeneratorResult {
  const { input, aiSlots } = params;
  const {
    schoolId,
    classId,
    sectionId,
    daysOfWeek,
    periods,
    subjects,
    existingLockedSlots = [],
    otherSectionSlots = [],
  } = input;

  const teachablePeriods = periods.filter((p) => !p.isBreak);
  const diagnostics: string[] = [];

  // Build teacher & room busy maps for other classes
  const teacherBusyMap = new Map<string, string>();
  const roomBusyMap = new Map<string, string>();

  for (const slot of otherSectionSlots) {
    if (slot.teacherId) {
      teacherBusyMap.set(
        `${slot.teacherId}_${slot.dayOfWeek}_${slot.startTime}`,
        `Class ${slot.classId} (${slot.subjectName})`,
      );
    }
    if (slot.room && slot.room.trim()) {
      roomBusyMap.set(
        `${slot.room.trim().toLowerCase()}_${slot.dayOfWeek}_${slot.startTime}`,
        `Class ${slot.classId} (${slot.subjectName})`,
      );
    }
  }

  // Grid for this section
  const grid = new Map<string, GeneratedSlot>();
  const subjectPlacedCount = new Map<string, number>();
  for (const s of subjects) {
    subjectPlacedCount.set(s.subjectName.toLowerCase(), 0);
  }

  // 1. Lock existing manual slots
  for (const locked of existingLockedSlots) {
    const period = teachablePeriods.find(
      (p) => p.startTime === locked.startTime,
    ) || {
      periodNumber: locked.periodNumber || 1,
      name: `Period ${locked.periodNumber || 1}`,
      startTime: locked.startTime,
      endTime: locked.endTime,
      isBreak: false,
    };
    const key = `${locked.dayOfWeek}_${period.periodNumber}`;
    grid.set(key, {
      dayOfWeek: locked.dayOfWeek,
      periodNumber: period.periodNumber,
      startTime: locked.startTime,
      endTime: locked.endTime,
      subjectName: locked.subjectName,
      teacherId: locked.teacherId,
      teacherName: locked.teacherName,
      room: locked.room,
      isLocked: true,
    });
    const sName = locked.subjectName.toLowerCase();
    subjectPlacedCount.set(sName, (subjectPlacedCount.get(sName) || 0) + 1);

    if (locked.teacherId) {
      teacherBusyMap.set(
        `${locked.teacherId}_${locked.dayOfWeek}_${locked.startTime}`,
        "Locked slot",
      );
    }
    if (locked.room?.trim()) {
      roomBusyMap.set(
        `${locked.room.trim().toLowerCase()}_${locked.dayOfWeek}_${locked.startTime}`,
        "Locked slot",
      );
    }
  }

  // 2. Validate and place Gemini AI proposed slots
  for (const aiSlot of aiSlots) {
    if (!daysOfWeek.includes(aiSlot.dayOfWeek)) continue;

    // Match period definition
    const matchingPeriod = teachablePeriods.find(
      (p) =>
        p.periodNumber === aiSlot.periodNumber ||
        p.startTime === aiSlot.startTime,
    );
    if (!matchingPeriod) continue;

    const key = `${aiSlot.dayOfWeek}_${matchingPeriod.periodNumber}`;
    if (grid.has(key)) continue; // Already occupied

    // Match subject quota
    const matchedSubject = subjects.find(
      (s) => s.subjectName.toLowerCase() === aiSlot.subjectName.toLowerCase(),
    );
    if (!matchedSubject) continue;

    const currentCount =
      subjectPlacedCount.get(matchedSubject.subjectName.toLowerCase()) || 0;
    if (currentCount >= matchedSubject.periodsPerWeek) continue; // Quota reached

    // Strictly use the teacher defined in the subject quota to prevent hallucinated IDs or foreign key errors
    const effectiveTeacherId = matchedSubject.teacherId || null;
    const effectiveTeacherName = matchedSubject.teacherName || null;
    const effectiveRoom =
      aiSlot.room && !aiSlot.room.toLowerCase().includes("optional")
        ? aiSlot.room
        : matchedSubject.room || null;

    // Check teacher clash
    if (effectiveTeacherId) {
      const busy = teacherBusyMap.get(
        `${effectiveTeacherId}_${aiSlot.dayOfWeek}_${matchingPeriod.startTime}`,
      );
      if (busy) {
        diagnostics.push(
          `AI slot for ${aiSlot.subjectName} on ${DAY_NAMES[aiSlot.dayOfWeek]} Period ${matchingPeriod.periodNumber} skipped: Teacher is busy in ${busy}.`,
        );
        continue;
      }
    }

    // Check room clash
    if (effectiveRoom?.trim()) {
      const roomKey = `${effectiveRoom.trim().toLowerCase()}_${aiSlot.dayOfWeek}_${matchingPeriod.startTime}`;
      const busy = roomBusyMap.get(roomKey);
      if (busy) {
        diagnostics.push(
          `AI slot for ${aiSlot.subjectName} on ${DAY_NAMES[aiSlot.dayOfWeek]} Period ${matchingPeriod.periodNumber} skipped: Room is booked.`,
        );
        continue;
      }
    }

    // Place verified slot
    grid.set(key, {
      dayOfWeek: aiSlot.dayOfWeek,
      periodNumber: matchingPeriod.periodNumber,
      startTime: matchingPeriod.startTime,
      endTime: matchingPeriod.endTime,
      subjectName: matchedSubject.subjectName,
      teacherId: effectiveTeacherId,
      teacherName: effectiveTeacherName,
      room: effectiveRoom,
      isLocked: false,
    });

    subjectPlacedCount.set(
      matchedSubject.subjectName.toLowerCase(),
      currentCount + 1,
    );

    if (effectiveTeacherId) {
      teacherBusyMap.set(
        `${effectiveTeacherId}_${aiSlot.dayOfWeek}_${matchingPeriod.startTime}`,
        `Section ${sectionId}`,
      );
    }
    if (effectiveRoom?.trim()) {
      roomBusyMap.set(
        `${effectiveRoom.trim().toLowerCase()}_${aiSlot.dayOfWeek}_${matchingPeriod.startTime}`,
        `Section ${sectionId}`,
      );
    }
  }

  // 3. Fallback resolution: If any subject has remaining quota, use deterministic solver
  const hasRemainingQuota = subjects.some((s) => {
    const placed = subjectPlacedCount.get(s.subjectName.toLowerCase()) || 0;
    return placed < s.periodsPerWeek;
  });

  if (hasRemainingQuota) {
    const currentSlotsAsLocked: ExistingSlot[] = Array.from(grid.values()).map(
      (s) => ({
        classId,
        sectionId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        periodNumber: s.periodNumber,
        subjectName: s.subjectName,
        teacherId: s.teacherId,
        teacherName: s.teacherName,
        room: s.room,
      }),
    );

    const fallbackResult = generateTimetable({
      schoolId,
      classId,
      sectionId,
      daysOfWeek,
      periods,
      subjects, // Full subjects list; generateTimetable subtracts currentSlotsAsLocked
      existingLockedSlots: currentSlotsAsLocked,
      otherSectionSlots,
    });

    for (const slot of fallbackResult.slots) {
      const key = `${slot.dayOfWeek}_${slot.periodNumber}`;
      if (!grid.has(key)) {
        grid.set(key, slot);
      }
    }

    if (fallbackResult.diagnostics.length > 0) {
      diagnostics.push(...fallbackResult.diagnostics);
    }
  }

  // Calculate totals and unassigned
  const finalSlots = Array.from(grid.values()).sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber,
  );

  const totalRequested = subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);
  const unassignedSubjects: GeneratorResult["unassignedSubjects"] = [];

  for (const s of subjects) {
    const placed = finalSlots.filter(
      (fs) => fs.subjectName.toLowerCase() === s.subjectName.toLowerCase(),
    ).length;
    const remaining = s.periodsPerWeek - placed;
    if (remaining > 0) {
      unassignedSubjects.push({
        subjectName: s.subjectName,
        remaining,
        reason:
          "No conflict-free slots available across teacher and room schedules.",
      });
    }
  }

  return {
    success: unassignedSubjects.length === 0,
    slots: finalSlots,
    totalSlots: totalRequested,
    allocatedSlots: finalSlots.length,
    unassignedSubjects,
    diagnostics,
  };
}
