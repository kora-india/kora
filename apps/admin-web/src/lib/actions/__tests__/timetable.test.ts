import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  getTimetablePeriods,
  saveTimetableSlot,
  getTimetable,
  checkSlotConflict,
  deleteTimetableSlot,
  generateAutomatedTimetableAction,
  auditSchoolConflicts,
} from "../timetable";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";

const schoolId =
  "timetable-test-school-" + Math.random().toString(36).substring(7);

describe("Timetable Generator & Conflict Resolution Engine", () => {
  let class1Id: string;
  let section1Id: string;
  let class2Id: string;
  let section2Id: string;
  let teacherAmitId: string;
  let teacherPriyaId: string;

  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "test-admin", schoolId, role: "SCHOOL_ADMIN" },
    } as any);

    // Create test school
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Timetable Academy",
        subdomain: "tt-" + Math.random().toString(36).substring(7),
      },
    });

    // Create 2 classes and 2 sections
    const c1 = await prisma.class.create({
      data: { schoolId, name: "Class 6", grade: 6 },
    });
    class1Id = c1.id;

    const s1 = await prisma.section.create({
      data: { schoolId, classId: class1Id, name: "A" },
    });
    section1Id = s1.id;

    const c2 = await prisma.class.create({
      data: { schoolId, name: "Class 7", grade: 7 },
    });
    class2Id = c2.id;

    const s2 = await prisma.section.create({
      data: { schoolId, classId: class2Id, name: "A" },
    });
    section2Id = s2.id;

    // Create 2 test teachers
    const u1 = await prisma.user.create({
      data: {
        email: `amit-${Math.random().toString(36).substring(7)}@test.com`,
        name: "Amit Sharma",
        password: "hash",
        schoolId,
        role: "TEACHER",
      },
    });
    const t1 = await prisma.teacher.create({
      data: {
        schoolId,
        userId: u1.id,
        name: "Amit Sharma",
        email: u1.email,
        subject: "Mathematics",
      },
    });
    teacherAmitId = t1.id;

    const u2 = await prisma.user.create({
      data: {
        email: `priya-${Math.random().toString(36).substring(7)}@test.com`,
        name: "Priya Singh",
        password: "hash",
        schoolId,
        role: "TEACHER",
      },
    });
    const t2 = await prisma.teacher.create({
      data: {
        schoolId,
        userId: u2.id,
        name: "Priya Singh",
        email: u2.email,
        subject: "Science",
      },
    });
    teacherPriyaId = t2.id;
  });

  it("should initialize default timetable periods when none exist", async () => {
    const periods = await getTimetablePeriods();
    expect(periods.length).toBeGreaterThanOrEqual(8);
    const period1 = periods.find((p) => p.periodNumber === 1);
    expect(period1).toBeDefined();
    expect(period1?.name).toBe("Period 1");
    expect(period1?.startTime).toBe("08:00");
  });

  it("should save a valid timetable slot manually", async () => {
    const res = await saveTimetableSlot({
      classId: class1Id,
      sectionId: section1Id,
      dayOfWeek: 1, // Monday
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "Mathematics",
      teacherId: teacherAmitId,
      room: "Room 101",
    });

    expect(res.success).toBe(true);
    expect(res.slot).toBeDefined();
    expect(res.slot?.subjectName).toBe("Mathematics");

    const slots = await getTimetable({ sectionId: section1Id });
    expect(slots.length).toBe(1);
    expect(slots[0].teacher?.name).toBe("Amit Sharma");
  });

  it("should detect teacher conflict when the same teacher is scheduled in another class at the same time", async () => {
    // Teacher Amit is already booked in Class 6A on Monday 08:00 - 08:45
    // Try to book Amit in Class 7A at the same day & time
    const conflictCheck = await checkSlotConflict({
      classId: class2Id,
      sectionId: section2Id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:45",
      teacherId: teacherAmitId,
    });

    expect(conflictCheck.hasConflict).toBe(true);
    expect(conflictCheck.conflictType).toBe("TEACHER");
    expect(conflictCheck.message).toContain(
      "Amit Sharma is already teaching Mathematics",
    );

    // Attempting to save should also be prevented
    const saveRes = await saveTimetableSlot({
      classId: class2Id,
      sectionId: section2Id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "Math Practice",
      teacherId: teacherAmitId,
    });

    expect(saveRes.success).toBe(false);
    expect(saveRes.error).toContain(
      "Amit Sharma is already teaching Mathematics",
    );
  });

  it("should detect room conflict when the same venue is booked at the same time", async () => {
    // Room 101 is already booked by Class 6A on Monday 08:00 - 08:45
    const conflictCheck = await checkSlotConflict({
      classId: class2Id,
      sectionId: section2Id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:45",
      teacherId: teacherPriyaId,
      room: "Room 101",
    });

    expect(conflictCheck.hasConflict).toBe(true);
    expect(conflictCheck.conflictType).toBe("ROOM");
    expect(conflictCheck.message).toContain(
      'Room "Room 101" is already booked',
    );
  });

  it("should allow booking another teacher in a different room at the same time", async () => {
    const res = await saveTimetableSlot({
      classId: class2Id,
      sectionId: section2Id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "Science",
      teacherId: teacherPriyaId,
      room: "Lab 1",
    });

    expect(res.success).toBe(true);
    const slots = await getTimetable({ sectionId: section2Id });
    expect(slots.length).toBe(1);
  });

  it("should run the automated timetable generator to allocate a full week without clashes", async () => {
    // Clear section 1 slots first
    const existing = await getTimetable({ sectionId: section1Id });
    for (const slot of existing) {
      await deleteTimetableSlot(slot.id);
    }

    const genRes = await generateAutomatedTimetableAction({
      classId: class1Id,
      sectionId: section1Id,
      daysOfWeek: [1, 2, 3, 4, 5, 6], // Mon-Sat
      subjects: [
        {
          subjectName: "Mathematics",
          periodsPerWeek: 6,
          teacherId: teacherAmitId,
          room: "Room 101",
        },
        {
          subjectName: "Science",
          periodsPerWeek: 6,
          teacherId: teacherPriyaId,
          room: "Science Lab",
        },
        { subjectName: "English", periodsPerWeek: 5, room: "Room 101" },
        { subjectName: "Social Studies", periodsPerWeek: 5, room: "Room 101" },
        { subjectName: "Computer", periodsPerWeek: 3, room: "Computer Lab" },
        {
          subjectName: "Physical Education",
          periodsPerWeek: 3,
          room: "Playground",
        },
      ],
      replaceExisting: true,
    });

    expect(genRes.success).toBe(true);
    expect(genRes.allocatedSlots).toBeGreaterThanOrEqual(25);

    // Verify all generated slots are stored in database
    const savedSlots = await getTimetable({ sectionId: section1Id });
    expect(savedSlots.length).toBe(genRes.allocatedSlots);

    // Verify no internal teacher clash on Section 1
    const audit = await auditSchoolConflicts();
    const section1Clashes = audit.filter((c) =>
      c.slots.some((s) => s.sectionId === section1Id),
    );
    expect(section1Clashes.length).toBe(0);
  });
});
