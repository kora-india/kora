import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { createStudent, deleteStudent, updateStudent } from "../students";
import { getNextAdmissionNumber } from "../admission-settings";
import { createTeacher, deleteTeacher } from "../teachers";
import { deleteClass } from "../classes";
import { updateRoute, deleteRoute } from "../transport";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `integrity-${run}`;
const otherSchoolId = `integrity-other-${run}`;

let classId: string;
let sectionA: string;
let sectionB: string;
let sessionId: string;

function studentInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Student",
    rollNumber: "1",
    admissionNumber: `ADM-${Math.random().toString(36).slice(2, 8)}`,
    classId,
    sectionId: sectionA,
    gender: "FEMALE",
    parentName: "Parent Name",
    parentPhone: "9999999999",
    ...overrides,
  };
}

describe("Data integrity (section 5)", () => {
  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "integrity-admin", schoolId, role: "SUPER_ADMIN" },
    } as any);

    await prisma.school.createMany({
      data: [
        {
          id: schoolId,
          name: "Integrity School",
          subdomain: `int-${run}`,
          plan: "PRO",
        },
        { id: otherSchoolId, name: "Other School", subdomain: `int-o-${run}` },
      ],
    });
    const session = await prisma.academicSession.create({
      data: {
        schoolId,
        name: "2026-27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
      },
    });
    sessionId = session.id;
    const cls = await prisma.class.create({
      data: { schoolId, name: "Grade 6", grade: 6 },
    });
    classId = cls.id;
    const [a, b] = await Promise.all([
      prisma.section.create({ data: { schoolId, classId, name: "A" } }),
      prisma.section.create({ data: { schoolId, classId, name: "B" } }),
    ]);
    sectionA = a.id;
    sectionB = b.id;
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
    await purgeSchool(prisma, otherSchoolId);
    await prisma.user.deleteMany({ where: { email: { contains: run } } });
  });

  describe("students", () => {
    it("D3: lets two schools use the same admission number", async () => {
      const otherClass = await prisma.class.create({
        data: { schoolId: otherSchoolId, name: "Grade 6", grade: 6 },
      });
      const otherSection = await prisma.section.create({
        data: { schoolId: otherSchoolId, classId: otherClass.id, name: "A" },
      });
      await prisma.student.create({
        data: {
          schoolId: otherSchoolId,
          classId: otherClass.id,
          sectionId: otherSection.id,
          name: "Elsewhere",
          rollNumber: "1",
          admissionNumber: `SHARED-${run}`,
          parentName: "Parent",
          parentPhone: "9999999999",
        },
      });

      const res = await createStudent(
        studentInput({ admissionNumber: `SHARED-${run}`, rollNumber: "50" }),
      );
      expect(res.error).toBeUndefined();
    });

    it("D3: advances the admission sequence only past numbers it produced", async () => {
      const next = await getNextAdmissionNumber();
      if (!("admissionNumber" in next)) throw new Error(String(next.error));
      const before = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: { nextAdmissionNumber: true },
      });

      await createStudent(
        studentInput({ admissionNumber: `MANUAL-${run}`, rollNumber: "51" }),
      );
      const afterManual = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: { nextAdmissionNumber: true },
      });
      expect(afterManual.nextAdmissionNumber).toBe(before.nextAdmissionNumber);

      await createStudent(
        studentInput({
          admissionNumber: next.admissionNumber,
          rollNumber: "52",
        }),
      );
      const afterSequence = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: { nextAdmissionNumber: true },
      });
      expect(afterSequence.nextAdmissionNumber).toBe(next.sequence! + 1);
    });

    it("D4: roll numbers are per section, and a withdrawn student's can be reused", async () => {
      const first = await createStudent(studentInput({ rollNumber: "7" }));
      expect(first.error).toBeUndefined();

      const clash = await createStudent(studentInput({ rollNumber: "7" }));
      expect(clash.error).toMatch(/already used by Test Student/);

      const otherSection = await createStudent(
        studentInput({ rollNumber: "7", sectionId: sectionB }),
      );
      expect(otherSection.error).toBeUndefined();

      await deleteStudent(first.id!);
      const reuse = await createStudent(studentInput({ rollNumber: "7" }));
      expect(reuse.error).toBeUndefined();

      // Editing a student checks too, ignoring the student's own number.
      const self = await updateStudent(reuse.id!, {
        ...studentInput({ rollNumber: "7" }),
        admissionNumber: (
          await prisma.student.findUniqueOrThrow({
            where: { id: reuse.id! },
          })
        ).admissionNumber,
      });
      expect(self.error).toBeUndefined();
    });

    it("D13: withdrawing a student ends their transport", async () => {
      const student = await createStudent(studentInput({ rollNumber: "60" }));
      const route = await prisma.transportRoute.create({
        data: {
          schoolId,
          name: `Withdraw route ${run}`,
          startPoint: "Depot",
          endPoint: "School",
          stops: { create: { stopName: "Stop", sequenceOrder: 1 } },
        },
        include: { stops: true },
      });
      await prisma.studentTransport.create({
        data: {
          schoolId,
          studentId: student.id!,
          sessionId,
          routeId: route.id,
          stopId: route.stops[0].id,
          distanceKm: 3,
          monthlyFee: 500,
        },
      });

      await deleteStudent(student.id!);
      const enrollment = await prisma.studentTransport.findFirst({
        where: { studentId: student.id! },
      });
      expect(enrollment?.status).toBe("INACTIVE");
      expect(enrollment?.endDate).not.toBeNull();
    });
  });

  describe("teachers", () => {
    it("D13: removing a teacher releases their classes and periods; adding them again reactivates the account", async () => {
      const email = `teacher-${run}@example.com`;
      const created = await createTeacher({
        name: "Meera Iyer",
        email,
        subject: "Science",
      });
      if (!created.success) throw new Error(created.error);

      await prisma.class.update({
        where: { id: classId },
        data: { classTeacherId: created.id },
      });
      await prisma.timetableSlot.create({
        data: {
          schoolId,
          classId,
          sectionId: sectionA,
          teacherId: created.id,
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "09:45",
          subjectName: "Science",
        },
      });

      const removed = await deleteTeacher(created.id);
      expect(removed).toMatchObject({
        success: true,
        releasedClasses: 1,
        releasedPeriods: 1,
      });
      const cls = await prisma.class.findUniqueOrThrow({
        where: { id: classId },
      });
      expect(cls.classTeacherId).toBeNull();

      const rehired = await createTeacher({
        name: "Meera Iyer",
        email,
        subject: "Physics",
      });
      if (!rehired.success) throw new Error(rehired.error);
      expect(rehired.reactivated).toBe(true);
      expect(rehired.id).toBe(created.id);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.isActive).toBe(true);
    });
  });

  describe("classes", () => {
    it("D18: won't delete a class whose exam marks belong to students who moved on", async () => {
      const oldClass = await prisma.class.create({
        data: { schoolId, name: `Grade 5 ${run}`, grade: 5 },
      });
      const student = await createStudent(studentInput({ rollNumber: "70" }));
      const exam = await prisma.exam.create({
        data: {
          schoolId,
          name: "Last year finals",
          academicYear: "2025-26",
          startDate: new Date("2026-03-01"),
          endDate: new Date("2026-03-10"),
          subjects: { create: { classId: oldClass.id, subjectName: "Maths" } },
        },
        include: { subjects: true },
      });
      await prisma.examMark.create({
        data: {
          examSubjectId: exam.subjects[0].id,
          studentId: student.id!,
          marksObtained: 88,
        },
      });

      const res = await deleteClass(oldClass.id);
      expect(res.error).toMatch(/exam marks/);
      expect(
        await prisma.examMark.count({ where: { studentId: student.id! } }),
      ).toBe(1);

      const emptyClass = await prisma.class.create({
        data: { schoolId, name: `Empty ${run}`, grade: 9 },
      });
      expect((await deleteClass(emptyClass.id)).success).toBe(true);
    });
  });

  describe("transport routes", () => {
    it("D1: editing or deleting a route never deletes students' enrollments", async () => {
      const student = await createStudent(studentInput({ rollNumber: "80" }));
      const route = await prisma.transportRoute.create({
        data: {
          schoolId,
          name: `Route ${run}`,
          startPoint: "Depot",
          endPoint: "School",
          stops: {
            create: [
              { stopName: "First Stop", sequenceOrder: 1 },
              { stopName: "Second Stop", sequenceOrder: 2 },
            ],
          },
        },
        include: { stops: { orderBy: { sequenceOrder: "asc" } } },
      });
      const [stop1, stop2] = route.stops;
      const enrollment = await prisma.studentTransport.create({
        data: {
          schoolId,
          studentId: student.id!,
          sessionId,
          routeId: route.id,
          stopId: stop1.id,
          distanceKm: 4,
          monthlyFee: 800,
        },
      });
      const base = {
        name: `Route ${run} renamed`,
        startPoint: "Depot",
        endPoint: "School",
        defaultRatePerKm: 100,
        status: "ACTIVE" as const,
      };

      // Renaming the route and a stop keeps the enrollment.
      const renamed = await updateRoute(route.id, {
        ...base,
        stops: [
          {
            id: stop1.id,
            stopName: "First Stop (gate)",
            sequenceOrder: 1,
            distanceFromSchoolKm: 4,
          },
          {
            id: stop2.id,
            stopName: "Second Stop",
            sequenceOrder: 2,
            distanceFromSchoolKm: 2,
          },
        ],
      });
      expect(renamed.error).toBeUndefined();
      expect(
        await prisma.studentTransport.findUnique({
          where: { id: enrollment.id },
        }),
      ).not.toBeNull();

      // Removing the stop the student uses is refused.
      const dropStop = await updateRoute(route.id, {
        ...base,
        stops: [
          {
            id: stop2.id,
            stopName: "Second Stop",
            sequenceOrder: 1,
            distanceFromSchoolKm: 2,
          },
        ],
      });
      expect(dropStop.error).toMatch(/1 students/);

      // A route with active students can't be deleted...
      expect((await deleteRoute(route.id)).error).toMatch(/enrolled/);

      // ...and once they've left, it is deactivated rather than deleted.
      await prisma.studentTransport.update({
        where: { id: enrollment.id },
        data: { status: "INACTIVE" },
      });
      const archived = await deleteRoute(route.id);
      expect(archived).toMatchObject({ success: true, archived: true });
      const after = await prisma.transportRoute.findUnique({
        where: { id: route.id },
      });
      expect(after?.status).toBe("INACTIVE");
      expect(
        await prisma.studentTransport.findUnique({
          where: { id: enrollment.id },
        }),
      ).not.toBeNull();
    });
  });
});
