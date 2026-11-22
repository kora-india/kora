import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { createStudent, updateStudent } from "../students";
import { bulkImportStudents } from "../student-import";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `ids-school-${run}`;
const otherSchoolId = `ids-other-${run}`;

describe("student PAN and APAAR ID", () => {
  let classId: string;
  let sectionId: string;
  let otherClassId: string;
  let otherSectionId: string;
  let n = 0;

  const signInTo = (school: string, userId: string) =>
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: userId,
        schoolId: school,
        role: "SCHOOL_ADMIN",
        name: "Admin",
      },
    } as any);

  const student = (over: Record<string, unknown> = {}) => {
    n++;
    return {
      name: `Pupil ${n}`,
      rollNumber: String(n),
      admissionNumber: `ADM-${run}-${n}`,
      classId,
      sectionId,
      gender: "FEMALE",
      parentName: "Parent",
      parentPhone: "9876543210",
      ...over,
    };
  };

  let adminId: string;
  let otherAdminId: string;

  beforeAll(async () => {
    for (const id of [schoolId, otherSchoolId]) {
      await prisma.school.create({
        data: { id, name: id, subdomain: id, plan: "PRO" },
      });
    }
    const admin = (school: string) =>
      prisma.user.create({
        data: {
          email: `ids-${school}@test.com`,
          name: "Admin",
          password: "hash",
          role: "SCHOOL_ADMIN",
          schoolId: school,
        },
      });
    adminId = (await admin(schoolId)).id;
    otherAdminId = (await admin(otherSchoolId)).id;
    const make = async (school: string) => {
      const c = await prisma.class.create({
        data: { schoolId: school, name: "Class 5", grade: 5 },
      });
      const s = await prisma.section.create({
        data: { schoolId: school, classId: c.id, name: "A" },
      });
      return [c.id, s.id];
    };
    [classId, sectionId] = await make(schoolId);
    [otherClassId, otherSectionId] = await make(otherSchoolId);
  });

  afterAll(async () => {
    for (const id of [schoolId, otherSchoolId]) {
      await prisma.activityLog.deleteMany({ where: { schoolId: id } });
      await prisma.user.deleteMany({ where: { schoolId: id } });
      await purgeSchool(prisma, id);
    }
  });

  const saved = (id: string) =>
    prisma.student.findUniqueOrThrow({
      where: { id },
      select: { panNumber: true, apaarId: true },
    });

  it("saves them cleaned up, and blank as nothing", async () => {
    signInTo(schoolId, adminId);
    const res = await createStudent(
      student({ panNumber: "abcde 1234 f", apaarId: "1234 5678 9012" }),
    );
    expect(res).toMatchObject({ success: true });
    expect(await saved((res as { id: string }).id)).toEqual({
      panNumber: "ABCDE1234F",
      apaarId: "123456789012",
    });

    const blank = await createStudent(
      student({ panNumber: "", apaarId: "  " }),
    );
    expect(await saved((blank as { id: string }).id)).toEqual({
      panNumber: null,
      apaarId: null,
    });
  });

  it("refuses ones that aren't a PAN or an APAAR ID", async () => {
    signInTo(schoolId, adminId);
    expect(await createStudent(student({ panNumber: "ABC123" }))).toEqual({
      error: "PAN must look like ABCDE1234F",
    });
    expect(await createStudent(student({ apaarId: "12345" }))).toEqual({
      error: "APAAR ID must be 12 digits",
    });
  });

  it("keeps each to one student in a school", async () => {
    signInTo(schoolId, adminId);
    const first = (await createStudent(
      student({
        name: "Meera Shah",
        panNumber: "PQRST6789K",
        apaarId: "111122223333",
      }),
    )) as { id: string };
    expect(await createStudent(student({ panNumber: "pqrst6789k" }))).toEqual({
      error: "PAN PQRST6789K is already used by Meera Shah",
    });
    expect(await createStudent(student({ apaarId: "1111 2222 3333" }))).toEqual(
      {
        error: "APAAR ID 111122223333 is already used by Meera Shah",
      },
    );

    // Editing her keeps her own IDs; giving another student hers doesn't.
    const meera = await prisma.student.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(
      await updateStudent(first.id, {
        ...student(),
        name: "Meera Shah",
        rollNumber: meera.rollNumber,
        admissionNumber: meera.admissionNumber,
        panNumber: "PQRST6789K",
        apaarId: "111122223333",
      }),
    ).toMatchObject({ success: true });
    const other = (await createStudent(student())) as { id: string };
    const otherRow = await prisma.student.findUniqueOrThrow({
      where: { id: other.id },
    });
    expect(
      await updateStudent(other.id, {
        ...student(),
        rollNumber: otherRow.rollNumber,
        admissionNumber: otherRow.admissionNumber,
        panNumber: "PQRST6789K",
      }),
    ).toEqual({ error: "PAN PQRST6789K is already used by Meera Shah" });
  });

  it("lets another school's student have the same IDs", async () => {
    signInTo(otherSchoolId, otherAdminId);
    const res = await createStudent(
      student({
        classId: otherClassId,
        sectionId: otherSectionId,
        panNumber: "PQRST6789K",
        apaarId: "111122223333",
      }),
    );
    expect(res).toMatchObject({ success: true });
  });

  it("imports them from a spreadsheet and reports clashes by row", async () => {
    signInTo(schoolId, adminId);
    const row = (sheetRow: number, over: Record<string, unknown>) => ({
      name: `Imported ${sheetRow}`,
      classId,
      sectionId,
      parentName: "Parent",
      parentPhone: "9876500000",
      sheetRow,
      ...over,
    });
    const res = await bulkImportStudents([
      row(2, { panNumber: "lmnop4321q", apaarId: 444455556666 }),
      row(3, { panNumber: "BAD" }),
      row(4, { apaarId: "111122223333" }),
      row(5, { panNumber: "LMNOP4321Q" }),
      row(6, {}),
    ]);
    expect(res.imported).toBe(2);
    expect(res.failed).toBe(3);
    expect(res.errors).toEqual([
      "Row 3: PAN must look like ABCDE1234F",
      "Row 4: APAAR ID 111122223333 already belongs to Meera Shah.",
      "Row 5: PAN LMNOP4321Q already belongs to Imported 2.",
    ]);
    const imported = await prisma.student.findFirstOrThrow({
      where: { schoolId, name: "Imported 2" },
      select: { panNumber: true, apaarId: true },
    });
    expect(imported).toEqual({
      panNumber: "LMNOP4321Q",
      apaarId: "444455556666",
    });
  });
});
