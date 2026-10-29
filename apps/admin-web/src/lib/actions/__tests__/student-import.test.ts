import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
  vi,
} from "vitest";
import { bulkImportStudents } from "../student-import";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";

const schoolId = "import-school-" + Math.random().toString(36).substring(7);

describe("Bulk Student Import", () => {
  let classId: string;
  let sectionId: string;

  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "test-user", schoolId, role: "SUPER_ADMIN" },
    } as any);

    // Clean DB
    await purgeSchool(prisma, schoolId);

    // Create required initial data
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Test School",
        subdomain: "testschool-" + Math.random().toString(36).substring(7),
      },
    });

    const c = await prisma.class.create({
      data: {
        schoolId,
        name: "Grade 10",
        grade: 10,
      },
    });
    classId = c.id;

    const s = await prisma.section.create({
      data: {
        schoolId,
        classId,
        name: "A",
      },
    });
    sectionId = s.id;
  });

  beforeEach(async () => {
    await prisma.student.deleteMany({ where: { schoolId } });
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  it("should successfully bulk import students", async () => {
    const runKey = Math.random().toString(36).substring(7);
    const data = [
      {
        name: "John Doe",
        classId,
        sectionId,
        parentName: "Mr. Doe",
        parentPhone: "1234567890",
        admissionNumber: "ADM-001-" + runKey,
        rollNumber: "1",
      },
      {
        name: "Jane Doe",
        classId,
        sectionId,
        parentName: "Mrs. Doe",
        parentPhone: "0987654321",
        admissionNumber: "ADM-002-" + runKey,
        rollNumber: "2",
      },
    ];

    const result = await bulkImportStudents(data);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);

    const students = await prisma.student.findMany({ where: { schoolId } });
    expect(students.length).toBe(2);
  });

  it("should auto-generate roll number and admission number if missing", async () => {
    const data = [
      {
        name: "No Roll",
        classId,
        sectionId,
        parentName: "Parent",
        parentPhone: "1234567890",
        // Missing admissionNumber and rollNumber
      },
    ];

    const result = await bulkImportStudents(data);
    expect(result.imported).toBe(1);

    const student = await prisma.student.findFirst({ where: { schoolId } });
    expect(student?.rollNumber).toBe("1");
    expect(student?.admissionNumber).toMatch(/^SCH-\d{4}-\d{4}$/);
  });

  it("should skip duplicate admission numbers", async () => {
    const dupeAdm = "ADM-DUPE-" + Math.random().toString(36).substring(7);
    // Insert an existing student
    await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        name: "Existing",
        parentName: "Parent",
        parentPhone: "123",
        admissionNumber: dupeAdm,
        rollNumber: "99",
      },
    });

    const data = [
      {
        name: "Duplicate",
        classId,
        sectionId,
        parentName: "Parent",
        parentPhone: "123",
        admissionNumber: dupeAdm, // duplicate
        rollNumber: "100",
      },
      {
        name: "New Student",
        classId,
        sectionId,
        parentName: "Parent",
        parentPhone: "123",
        admissionNumber: "ADM-NEW-" + Math.random().toString(36).substring(7),
        rollNumber: "101",
      },
    ];

    const result = await bulkImportStudents(data);

    // One imported, one skipped
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);

    const students = await prisma.student.findMany({ where: { schoolId } });
    expect(students.length).toBe(2); // The existing one + the valid one
  });

  it("D5: reads DD/MM/YYYY and Excel dates, and reports dates it can't read", async () => {
    const row = (
      name: string,
      dateOfBirth: string | number,
      rollNumber: string,
    ) => ({
      name,
      classId,
      sectionId,
      parentName: "Parent",
      parentPhone: "1234567890",
      rollNumber,
      dateOfBirth,
    });
    const result = await bulkImportStudents([
      row("Indian Date", "05/06/2010", "11"),
      row("Excel Date", 40321, "12"),
      row("Bad Date", "31/02/2010", "13"),
    ]);
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toMatch(
      /Row 3: Date of birth "31\/02\/2010"/,
    );

    const indian = await prisma.student.findFirstOrThrow({
      where: { schoolId, name: "Indian Date" },
    });
    // 5 June, not 6 May
    expect(indian.dateOfBirth?.toISOString().slice(0, 10)).toBe("2010-06-05");
    const excel = await prisma.student.findFirstOrThrow({
      where: { schoolId, name: "Excel Date" },
    });
    expect(excel.dateOfBirth?.toISOString().slice(0, 10)).toBe("2010-05-23");
  });

  it("D6: reports duplicates instead of silently dropping students", async () => {
    await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        name: "Holder",
        parentName: "Parent",
        parentPhone: "123",
        admissionNumber: "HOLD-" + Math.random().toString(36).slice(2, 7),
        rollNumber: "21",
      },
    });
    const adm = "SAME-" + Math.random().toString(36).slice(2, 7);
    const base = {
      classId,
      sectionId,
      parentName: "Parent",
      parentPhone: "1234567890",
    };
    const result = await bulkImportStudents([
      { ...base, name: "First Copy", admissionNumber: adm, rollNumber: "22" },
      { ...base, name: "Second Copy", admissionNumber: adm, rollNumber: "23" },
      { ...base, name: "Roll Clash", rollNumber: "21" },
    ]);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    const messages = result.errors.join(" ");
    expect(messages).toMatch(/Row 2: .*more than once/);
    expect(messages).toMatch(
      /Row 3: .*roll number 21 is already used by Holder/,
    );
  });

  it("D6: matches a class however the sheet writes it", async () => {
    const result = await bulkImportStudents([
      {
        name: "Class Spelling",
        classId: "Class 10", // the school's class is "Grade 10"
        sectionId: "A",
        parentName: "Parent",
        parentPhone: "1234567890",
      },
    ]);
    expect(result.imported).toBe(1);
    const student = await prisma.student.findFirstOrThrow({
      where: { schoolId, name: "Class Spelling" },
    });
    expect(student.classId).toBe(classId);
    expect(await prisma.class.count({ where: { schoolId } })).toBe(1);
  });

  it("says plainly what a row is missing, by the sheet's own row number", async () => {
    const result = await bulkImportStudents([
      { classId, sectionId, parentPhone: "9000000000", sheetRow: 5 },
      {
        name: "  ",
        classId,
        sectionId,
        parentName: "P",
        parentPhone: 9000000000,
      },
    ]);
    expect(result.failed).toBe(2);
    expect(result.errors).toContain(
      "Row 5: Student name is missing; Parent name is missing",
    );
    expect(result.errors).toContain("Row 2: Student name is missing");
  });

  it("keeps the email, blood group and address the sheet gives", async () => {
    const result = await bulkImportStudents([
      {
        name: "Full Record",
        classId,
        sectionId,
        parentName: "Parent",
        parentPhone: 9416940224,
        parentEmail: "parent@example.com",
        bloodGroup: "A-",
        address: "House No. 1, Main Road",
        city: "Chandil",
        state: "Jharkhand",
        pincode: 832401,
      },
    ]);
    expect(result.imported).toBe(1);
    const student = await prisma.student.findFirstOrThrow({
      where: { schoolId, name: "Full Record" },
    });
    expect(student).toMatchObject({
      parentPhone: "9416940224",
      parentEmail: "parent@example.com",
      bloodGroup: "A-",
      address: "House No. 1, Main Road",
      city: "Chandil",
      state: "Jharkhand",
      pincode: "832401",
    });
  });

  it("treats roll 04 and roll 4 in a section as the same roll", async () => {
    const base = {
      classId,
      sectionId,
      parentName: "P",
      parentPhone: "9000000000",
    };
    const result = await bulkImportStudents([
      { ...base, name: "Roll Four", rollNumber: "4" },
      { ...base, name: "Roll Zero Four", rollNumber: "04" },
    ]);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors.join(" ")).toMatch(
      /Row 2: .*roll number 04 is already used by Roll Four/,
    );
  });
});
