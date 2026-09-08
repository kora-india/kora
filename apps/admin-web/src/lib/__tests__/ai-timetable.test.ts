import { describe, it, expect } from "vitest";
import {
  validateAndRefineAiTimetable,
  generateTimetable,
  PeriodDefinition,
  SubjectQuota,
  ExistingSlot,
} from "../timetable-generator";

describe("AI Timetable Validator & Conflict Resolution Engine", () => {
  const periods: PeriodDefinition[] = [
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
      name: "Break",
      startTime: "09:30",
      endTime: "09:50",
      isBreak: true,
    },
    {
      periodNumber: 4,
      name: "Period 3",
      startTime: "09:50",
      endTime: "10:35",
      isBreak: false,
    },
    {
      periodNumber: 5,
      name: "Period 4",
      startTime: "10:35",
      endTime: "11:20",
      isBreak: false,
    },
  ];

  const subjects: SubjectQuota[] = [
    {
      subjectName: "Mathematics",
      periodsPerWeek: 4,
      teacherId: "teacher-math",
      teacherName: "Mr. Math",
    },
    {
      subjectName: "Science",
      periodsPerWeek: 4,
      teacherId: "teacher-sci",
      teacherName: "Dr. Science",
      room: "Lab",
    },
    {
      subjectName: "English",
      periodsPerWeek: 3,
      teacherId: "teacher-eng",
      teacherName: "Ms. English",
    },
  ];

  it("should accept valid conflict-free AI draft slots", () => {
    const aiSlots = [
      {
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
        subjectName: "Mathematics",
        teacherId: "teacher-math",
      },
      {
        dayOfWeek: 1,
        periodNumber: 2,
        startTime: "08:45",
        endTime: "09:30",
        subjectName: "Science",
        teacherId: "teacher-sci",
        room: "Lab",
      },
      {
        dayOfWeek: 2,
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
        subjectName: "English",
        teacherId: "teacher-eng",
      },
    ];

    const result = validateAndRefineAiTimetable({
      input: {
        schoolId: "school-1",
        classId: "class-1",
        sectionId: "section-1",
        daysOfWeek: [1, 2, 3, 4, 5],
        periods,
        subjects,
      },
      aiSlots,
    });

    expect(result.success).toBe(true);
    expect(result.slots.length).toBe(11); // 4 Math + 4 Science + 3 English

    // Verify AI slots were preserved
    const monP1 = result.slots.find(
      (s) => s.dayOfWeek === 1 && s.periodNumber === 1,
    );
    expect(monP1?.subjectName).toBe("Mathematics");

    const monP2 = result.slots.find(
      (s) => s.dayOfWeek === 1 && s.periodNumber === 2,
    );
    expect(monP2?.subjectName).toBe("Science");
  });

  it("should detect teacher clashes in AI drafts and automatically resolve them without conflict", () => {
    // Other class has teacher-math busy on Monday Period 1 (08:00)
    const otherSectionSlots: ExistingSlot[] = [
      {
        classId: "class-other",
        sectionId: "section-other",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "08:45",
        subjectName: "Math in other class",
        teacherId: "teacher-math",
        teacherName: "Mr. Math",
      },
    ];

    // AI proposed scheduling teacher-math on Monday Period 1 (CLASH!)
    const clashingAiSlots = [
      {
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
        subjectName: "Mathematics",
        teacherId: "teacher-math",
      },
    ];

    const result = validateAndRefineAiTimetable({
      input: {
        schoolId: "school-1",
        classId: "class-1",
        sectionId: "section-1",
        daysOfWeek: [1, 2, 3, 4, 5],
        periods,
        subjects,
        otherSectionSlots,
      },
      aiSlots: clashingAiSlots,
    });

    expect(result.success).toBe(true);
    expect(result.slots.length).toBe(11);

    // Verify Monday Period 1 does NOT have teacher-math (clash prevented!)
    const monP1 = result.slots.find(
      (s) => s.dayOfWeek === 1 && s.periodNumber === 1,
    );
    expect(monP1?.teacherId).not.toBe("teacher-math");

    // Verify diagnostic noted the clash avoidance
    expect(
      result.diagnostics.some((d) => d.includes("skipped: Teacher is busy")),
    ).toBe(true);

    // Verify teacher-math is placed in 4 other conflict-free periods
    const mathSlots = result.slots.filter(
      (s) => s.subjectName === "Mathematics",
    );
    expect(mathSlots.length).toBe(4);
    for (const slot of mathSlots) {
      expect(!(slot.dayOfWeek === 1 && slot.startTime === "08:00")).toBe(true);
    }
  });

  it("should reject AI draft slots on break periods and place them in teachable periods", () => {
    // AI erroneously tried to place English during Break (09:30)
    const breakAiSlots = [
      {
        dayOfWeek: 1,
        periodNumber: 3, // Break period
        startTime: "09:30",
        endTime: "09:50",
        subjectName: "English",
        teacherId: "teacher-eng",
      },
    ];

    const result = validateAndRefineAiTimetable({
      input: {
        schoolId: "school-1",
        classId: "class-1",
        sectionId: "section-1",
        daysOfWeek: [1, 2, 3, 4, 5],
        periods,
        subjects,
      },
      aiSlots: breakAiSlots,
    });

    expect(result.success).toBe(true);
    expect(result.slots.length).toBe(11);

    // No slot should ever be in Period 3 (Break)
    expect(result.slots.some((s) => s.periodNumber === 3)).toBe(false);
  });

  it("should detect room clashes in AI drafts and reroute them", () => {
    // Room "Lab" is booked by another section on Tuesday Period 1 (08:00)
    const otherSectionSlots: ExistingSlot[] = [
      {
        classId: "class-other",
        sectionId: "section-other",
        dayOfWeek: 2,
        startTime: "08:00",
        endTime: "08:45",
        subjectName: "Physics Lab",
        room: "Lab",
      },
    ];

    // AI proposed scheduling Science in "Lab" at the same time
    const clashingAiSlots = [
      {
        dayOfWeek: 2,
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
        subjectName: "Science",
        teacherId: "teacher-sci",
        room: "Lab",
      },
    ];

    const result = validateAndRefineAiTimetable({
      input: {
        schoolId: "school-1",
        classId: "class-1",
        sectionId: "section-1",
        daysOfWeek: [1, 2, 3, 4, 5],
        periods,
        subjects,
        otherSectionSlots,
      },
      aiSlots: clashingAiSlots,
    });

    expect(result.success).toBe(true);
    // Verify Tuesday Period 1 does not book "Lab"
    const tueP1 = result.slots.find(
      (s) => s.dayOfWeek === 2 && s.periodNumber === 1,
    );
    expect(tueP1?.room).not.toBe("Lab");
  });

  it("should seamlessly fulfill full conflict-free schedule via deterministic engine on AI fallback", () => {
    // Simulates what happens when Gemini throws 503 and timetable action invokes fallback
    const result = generateTimetable({
      schoolId: "school-1",
      classId: "class-1",
      sectionId: "section-1",
      daysOfWeek: [1, 2, 3, 4, 5],
      periods,
      subjects,
    });

    expect(result.success).toBe(true);
    expect(result.allocatedSlots).toBe(11);
    expect(result.unassignedSubjects.length).toBe(0);

    // No break period slots scheduled
    expect(result.slots.some((s) => s.periodNumber === 3)).toBe(false);
  });
});
