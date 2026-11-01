import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { ROLE_DEFAULT_PERMISSIONS, UserRole } from "@schoolos/types";
import {
  checkAttendanceImport,
  getAttendanceImportSetup,
  getAttendanceTemplate,
  importAttendance,
  undoAttendanceImport,
} from "../attendance-import";
import { markAttendance } from "../attendance";
import type { AttendanceRow } from "@/lib/attendance-import";

const suffix = Math.random().toString(36).slice(2, 8);
const schoolId = `att-import-${suffix}`;
const otherSchoolId = `att-other-${suffix}`;
const adm = (name: string) => `${name}-${suffix}`;

const signIn = (id: string, role: string, school = schoolId) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId: school, role, name: "Asha Admin" },
  } as any);

let nextRow = 2;
const row = (
  name: string,
  marks: Record<string, string>,
  period = "2026-04",
): AttendanceRow => ({
  period,
  sheetRow: nextRow++,
  admissionNumber: adm(name),
  marks,
});

describe("attendance import", () => {
  let adminId: string;
  let plainTeacher: string;
  let allowedTeacher: string;
  let classId: string;
  let sectionA: string;
  let sectionB: string;
  let ids: { classId: string; sectionId: string };
  let asha: string;

  const teacherAccess = { ...ROLE_DEFAULT_PERMISSIONS[UserRole.TEACHER] };

  beforeAll(async () => {
    for (const id of [schoolId, otherSchoolId]) {
      await prisma.school.create({
        data: {
          id,
          name: id,
          subdomain: id,
          plan: "PRO",
          workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        },
      });
    }
    await prisma.academicSession.create({
      data: {
        schoolId,
        name: "2026-27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
      },
    });
    const user = (name: string, role: string, permissions?: object) =>
      prisma.user.create({
        data: {
          email: `${name}-${suffix}@test.com`,
          name,
          password: "hash",
          role: role as any,
          schoolId,
          ...(permissions ? { permissions } : {}),
        },
      });
    adminId = (await user("admin", "SCHOOL_ADMIN")).id;
    plainTeacher = (await user("plain", "TEACHER")).id;
    allowedTeacher = (
      await user("allowed", "TEACHER", {
        ...teacherAccess,
        attendanceImport: "manage",
      })
    ).id;

    classId = (
      await prisma.class.create({
        data: { schoolId, name: "Class 4", grade: 4 },
      })
    ).id;
    const section = async (name: string) =>
      (await prisma.section.create({ data: { schoolId, classId, name } })).id;
    sectionA = await section("A");
    sectionB = await section("B");
    ids = { classId, sectionId: sectionA };

    await prisma.teacher.create({
      data: {
        schoolId,
        userId: allowedTeacher,
        name: "allowed",
        email: `allowed-${suffix}@test.com`,
        subject: "Maths",
        assignedSections: {
          create: { schoolId, classId, sectionId: sectionA },
        },
      } as any,
    });

    const student = async (name: string, sectionId: string, roll: string) =>
      (
        await prisma.student.create({
          data: {
            schoolId,
            classId,
            sectionId,
            name,
            rollNumber: roll,
            admissionNumber: adm(name),
            parentName: "Parent",
            parentPhone: "9999999999",
          },
        })
      ).id;
    asha = await student("Asha", sectionA, "2");
    await student("Kabir", sectionA, "1");
    await student("Meera", sectionB, "1");
  });

  beforeEach(async () => {
    signIn(adminId, "SCHOOL_ADMIN");
    await prisma.attendance.deleteMany({ where: { schoolId } });
    await prisma.attendanceImport.deleteMany({ where: { schoolId } });
    await prisma.activityLog.deleteMany({ where: { schoolId } });
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { schoolId } });
    await prisma.teacher.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await purgeSchool(prisma, schoolId);
    await purgeSchool(prisma, otherSchoolId);
  });

  const records = () => prisma.attendance.count({ where: { schoolId } });
  const imported = async (rows: AttendanceRow[]) => {
    const res = await importAttendance({ ...ids, fileName: "a.xlsx", rows });
    if ("error" in res) throw new Error(res.error);
    return res;
  };

  describe("who can do it", () => {
    const rows = () => [row("Asha", { "1": "P" })];

    it("is on for school admins", async () => {
      expect(await imported(rows())).toMatchObject({ records: 1 });
    });

    it("is off for teachers until the admin allows it", async () => {
      signIn(plainTeacher, "TEACHER");
      for (const res of [
        await getAttendanceImportSetup(),
        await getAttendanceTemplate({ ...ids, from: "2026-04", to: "2026-04" }),
        await checkAttendanceImport({ ...ids, rows: rows() }),
        await importAttendance({ ...ids, rows: rows() }),
        await undoAttendanceImport("x"),
      ]) {
        expect(res).toEqual({ error: "Unauthorized" });
      }
      expect(await records()).toBe(0);
    });

    it("is off for accountants by default", async () => {
      const accountant = await prisma.user.create({
        data: {
          email: `acc-${suffix}@test.com`,
          name: "Accounts",
          password: "hash",
          role: "ACCOUNTANT",
          schoolId,
        },
      });
      signIn(accountant.id, "ACCOUNTANT");
      expect(await getAttendanceImportSetup()).toEqual({
        error: "Unauthorized",
      });
    });

    it("lets an allowed teacher import for their own section", async () => {
      signIn(allowedTeacher, "TEACHER");
      expect(await imported(rows())).toMatchObject({ records: 1 });
    });

    it("keeps an allowed teacher to their own sections", async () => {
      signIn(allowedTeacher, "TEACHER");
      const other = { classId, sectionId: sectionB };
      const cant = { error: "You can't import attendance for that section" };
      expect(
        await getAttendanceTemplate({
          ...other,
          from: "2026-04",
          to: "2026-04",
        }),
      ).toEqual(cant);
      expect(
        await checkAttendanceImport({
          ...other,
          rows: [row("Meera", { "1": "P" })],
        }),
      ).toEqual(cant);
      expect(
        await importAttendance({
          ...other,
          rows: [row("Meera", { "1": "P" })],
        }),
      ).toEqual(cant);
      expect(await records()).toBe(0);
    });

    it("shows an allowed teacher only their sections and imports", async () => {
      await importAttendance({
        classId,
        sectionId: sectionB,
        rows: [row("Meera", { "1": "P" })],
      });
      await imported(rows());

      signIn(allowedTeacher, "TEACHER");
      const setup = await getAttendanceImportSetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.classes).toEqual([
        {
          id: classId,
          name: "Class 4",
          sections: [{ id: sectionA, name: "A" }],
        },
      ]);
      expect(setup.imports.map((i) => i.sectionName)).toEqual(["A"]);
    });

    it("won't undo another section's import for a teacher", async () => {
      const res = await importAttendance({
        classId,
        sectionId: sectionB,
        rows: [row("Meera", { "1": "P" })],
      });
      if ("error" in res) throw new Error(res.error);

      signIn(allowedTeacher, "TEACHER");
      expect(await undoAttendanceImport(res.id)).toHaveProperty("error");
      expect(await records()).toBe(1);
    });

    it("keeps to the signed-in school", async () => {
      const res = await imported(rows());
      signIn("someone", "SCHOOL_ADMIN", otherSchoolId);
      expect(await undoAttendanceImport(res.id)).toEqual({
        error: "That import wasn't found",
      });
      expect(await importAttendance({ ...ids, rows: rows() })).toEqual({
        error: "You can't import attendance for that section",
      });
      expect(await records()).toBe(1);
    });
  });

  describe("template", () => {
    it("lists the section's current students by roll number", async () => {
      const res = await getAttendanceTemplate({
        ...ids,
        from: "2026-04",
        to: "2026-05",
      });
      expect(res).toMatchObject({
        className: "Class 4",
        sectionName: "A",
        months: ["2026-04", "2026-05"],
        workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      });
      expect("students" in res && res.students.map((s) => s.name)).toEqual([
        "Kabir",
        "Asha",
      ]);
    });

    it("refuses months it can't list", async () => {
      const ask = (from: string, to: string) =>
        getAttendanceTemplate({ ...ids, from, to });
      expect(await ask("2026-05", "2026-04")).toEqual({
        error: "Choose the months to include",
      });
      expect(await ask("2999-01", "2999-02")).toEqual({
        error: "The last month can't be in the future",
      });
      expect(await ask("2024-01", "2026-04")).toEqual({
        error: "Choose 12 months or fewer at a time",
      });
    });
  });

  describe("check", () => {
    it("says what importing would do, and saves nothing", async () => {
      const res = await checkAttendanceImport({
        ...ids,
        rows: [row("Asha", { "1": "P", "2": "A" }), row("Kabir", { "1": "L" })],
      });
      expect(res).toMatchObject({
        success: true,
        problems: [],
        totals: {
          students: 2,
          days: 2,
          records: 3,
          present: 1,
          absent: 1,
          late: 1,
        },
      });
      expect(await records()).toBe(0);
    });

    it("refuses a student from another section", async () => {
      const res = await checkAttendanceImport({
        ...ids,
        rows: [row("Meera", { "1": "P" })],
      });
      expect("problems" in res && res.problems[0]).toContain(
        "isn't in Class 4-A",
      );
    });
  });

  describe("import", () => {
    it("saves real attendance, tied to the import", async () => {
      const res = await imported([row("Asha", { "1": "P", "2": "L" })]);
      const saved = await prisma.attendance.findMany({
        where: { studentId: asha },
        orderBy: { date: "asc" },
      });
      expect(saved.map((a) => a.status)).toEqual(["PRESENT", "LATE"]);
      expect(saved[0]).toMatchObject({
        classId,
        sectionId: sectionA,
        markedById: adminId,
        importId: res.id,
      });
      expect(saved[0].date.toISOString().slice(0, 10)).toBe("2026-04-01");
    });

    it("records what it did and logs it", async () => {
      await imported([
        row("Asha", { "1": "P", "2": "P" }),
        row("Kabir", { "1": "A" }, "2026-05"),
      ]);
      const setup = await getAttendanceImportSetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.imports).toEqual([
        expect.objectContaining({
          className: "Class 4",
          sectionName: "A",
          fromMonth: "2026-04",
          toMonth: "2026-05",
          fileName: "a.xlsx",
          recordCount: 3,
          undoneAt: null,
        }),
      ]);
      const log = await prisma.activityLog.findFirst({ where: { schoolId } });
      expect(log?.action).toBe("attendance.import");
      expect(log?.summary).toContain("3 records over 3 days");
    });

    it("leaves days already marked exactly as they are", async () => {
      await markAttendance({
        ...ids,
        date: "2026-04-01",
        records: [{ studentId: asha, status: "ABSENT" }],
      });

      const res = await imported([row("Asha", { "1": "P", "2": "P" })]);

      expect(res).toMatchObject({ records: 1, skipped: 1 });
      const kept = await prisma.attendance.findFirstOrThrow({
        where: { studentId: asha, date: new Date("2026-04-01") },
      });
      expect(kept).toMatchObject({ status: "ABSENT", importId: null });
    });

    it("saves nothing if any of the file has a problem", async () => {
      const res = await importAttendance({
        ...ids,
        rows: [row("Asha", { "1": "P" }), row("Kabir", { "1": "X" })],
      });
      expect(res).toHaveProperty("error");
      expect(await records()).toBe(0);
      expect(await prisma.attendanceImport.count({ where: { schoolId } })).toBe(
        0,
      );
    });

    it("adds nothing when the same file comes again", async () => {
      const rows = [row("Asha", { "1": "P" })];
      await imported(rows);
      expect(await importAttendance({ ...ids, rows })).toEqual({
        error: "There's nothing new to import in this file",
      });
      expect(await records()).toBe(1);
    });
  });

  describe("undo", () => {
    it("takes the records back out and logs it", async () => {
      const res = await imported([row("Asha", { "1": "P", "2": "P" })]);

      expect(await undoAttendanceImport(res.id)).toEqual({
        success: true,
        removed: 2,
        kept: 0,
      });

      expect(await records()).toBe(0);
      const setup = await getAttendanceImportSetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.imports[0].undoneAt).not.toBeNull();
      expect(
        await prisma.activityLog.count({
          where: { schoolId, action: "attendance.import_undo" },
        }),
      ).toBe(1);
    });

    it("keeps a day a teacher corrected since", async () => {
      const res = await imported([row("Asha", { "1": "P", "2": "P" })]);
      await markAttendance({
        ...ids,
        date: "2026-04-01",
        records: [{ studentId: asha, status: "ABSENT" }],
      });

      expect(await undoAttendanceImport(res.id)).toEqual({
        success: true,
        removed: 1,
        kept: 1,
      });

      const left = await prisma.attendance.findMany({ where: { schoolId } });
      expect(left).toHaveLength(1);
      expect(left[0].status).toBe("ABSENT");
    });

    it("leaves other imports alone", async () => {
      const first = await imported([row("Asha", { "1": "P" })]);
      await imported([row("Kabir", { "1": "P" })]);

      await undoAttendanceImport(first.id);

      expect(await records()).toBe(1);
    });

    it("only happens once", async () => {
      const res = await imported([row("Asha", { "1": "P" })]);
      await undoAttendanceImport(res.id);
      expect(await undoAttendanceImport(res.id)).toEqual({
        error: "That import was already undone",
      });
    });

    it("lets the file be imported again afterwards", async () => {
      const rows = [row("Asha", { "1": "P" })];
      const res = await imported(rows);
      await undoAttendanceImport(res.id);
      expect(await imported(rows)).toMatchObject({ records: 1 });
    });
  });
});
