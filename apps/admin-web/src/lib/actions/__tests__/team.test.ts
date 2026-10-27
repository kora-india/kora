import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Prisma, prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { getSchoolAccess, requirePermission } from "@/lib/auth-guard";
import {
  createAccountant,
  removeAccountant,
  resetMemberPermissions,
  updateMemberPermissions,
} from "../team";
import { getAttendanceForClass } from "../attendance";
import { ROLE_DEFAULT_PERMISSIONS, UserRole } from "@schoolos/types";

const suffix = Math.random().toString(36).substring(7);
const schoolId = `team-test-school-${suffix}`;
const otherSchoolId = `team-test-other-${suffix}`;

const signInAs = (id: string, role: string, school: string | null = schoolId) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId: school, role },
  } as any);

describe("per-person permissions", () => {
  let teacherId: string;
  let otherTeacherId: string;

  beforeAll(async () => {
    for (const id of [schoolId, otherSchoolId]) {
      await prisma.school.create({
        data: { id, name: `School ${id}`, subdomain: id, plan: "PRO" },
      });
    }
    teacherId = (
      await prisma.user.create({
        data: {
          email: `teacher-${suffix}@test.com`,
          name: "Amit Sharma",
          password: "hash",
          role: "TEACHER",
          schoolId,
        },
      })
    ).id;
    otherTeacherId = (
      await prisma.user.create({
        data: {
          email: `other-${suffix}@test.com`,
          name: "Elsewhere",
          password: "hash",
          role: "TEACHER",
          schoolId: otherSchoolId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.school.deleteMany({
      where: { id: { in: [schoolId, otherSchoolId] } },
    });
  });

  describe("the server check", () => {
    it("gives a teacher with nothing saved the teacher defaults", async () => {
      signInAs(teacherId, "TEACHER");
      const access = await getSchoolAccess();
      expect(access).toMatchObject({
        permissions: ROLE_DEFAULT_PERMISSIONS[UserRole.TEACHER],
      });
      expect(await requirePermission("attendance", "manage")).toHaveProperty(
        "id",
        teacherId,
      );
      expect(await requirePermission("fees")).toEqual({
        error: "Forbidden: You do not have permission for this action",
      });
    });

    it("follows what the admin saved, at once", async () => {
      await prisma.user.update({
        where: { id: teacherId },
        data: {
          permissions: {
            ...ROLE_DEFAULT_PERMISSIONS[UserRole.TEACHER],
            fees: "view",
            attendance: "none",
          },
        },
      });
      signInAs(teacherId, "TEACHER");
      expect(await requirePermission("fees")).toHaveProperty("id", teacherId);
      expect(await requirePermission("fees", "manage")).toHaveProperty("error");
      // A real action refuses too.
      expect(await getAttendanceForClass("c", "s", "2026-10-01")).toEqual({
        error: "Forbidden: You do not have permission for this action",
      });
    });

    it("refuses a login that was turned off", async () => {
      await prisma.user.update({
        where: { id: teacherId },
        data: { isActive: false },
      });
      signInAs(teacherId, "TEACHER");
      expect(await requirePermission("students")).toEqual({
        error: "Unauthorized",
      });
      await prisma.user.update({
        where: { id: teacherId },
        data: { isActive: true, permissions: Prisma.DbNull },
      });
    });
  });

  describe("Team & access", () => {
    const teacherDefaults = ROLE_DEFAULT_PERMISSIONS[UserRole.TEACHER];

    it("is for school admins only", async () => {
      signInAs(teacherId, "TEACHER");
      expect(
        await updateMemberPermissions(teacherId, {
          ...teacherDefaults,
          staff: "manage",
        }),
      ).toEqual({ error: "Unauthorized" });
      expect(
        await createAccountant({ name: "Sneaky", email: "s@test.com" }),
      ).toEqual({ error: "Unauthorized" });
    });

    it("saves a member's access and resets it to the role defaults", async () => {
      signInAs("admin", "SCHOOL_ADMIN");
      const saved = await updateMemberPermissions(teacherId, {
        ...teacherDefaults,
        fees: "view",
      });
      expect(saved).toEqual({
        success: true,
        message: "Amit Sharma's access saved",
      });
      let row = await prisma.user.findUnique({ where: { id: teacherId } });
      expect(row?.permissions).toMatchObject({ fees: "view" });

      expect(await resetMemberPermissions(teacherId)).toMatchObject({
        success: true,
      });
      row = await prisma.user.findUnique({ where: { id: teacherId } });
      expect(row?.permissions).toBeNull();
    });

    it("refuses bad input, impossible combinations and other schools", async () => {
      signInAs("admin", "SCHOOL_ADMIN");
      expect(
        await updateMemberPermissions(teacherId, { fees: "view" }),
      ).toHaveProperty("error");
      expect(
        await updateMemberPermissions(teacherId, {
          ...teacherDefaults,
          exams: "none",
        }),
      ).toEqual({ error: "Marks entry needs Exams set to View or Manage" });
      expect(
        await updateMemberPermissions(otherTeacherId, teacherDefaults),
      ).toEqual({
        error: "That login isn't a teacher or accountant at your school",
      });
    });

    it("adds, removes and restores an accountant login", async () => {
      signInAs("admin", "SCHOOL_ADMIN");
      const email = `Accounts-${suffix}@Test.com`;
      const created = await createAccountant({ name: "Ravi Accounts", email });
      expect(created).toMatchObject({ success: true, reactivated: false });
      if (!("tempPassword" in created)) throw new Error("not created");
      expect(created.tempPassword).toMatch(/^[A-Za-z0-9]{16}$/);

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      expect(user).toMatchObject({
        role: "ACCOUNTANT",
        schoolId,
        mustChangePassword: true,
        permissions: null,
      });

      expect(await createAccountant({ name: "Again", email })).toEqual({
        error: "A user with this email already exists",
      });
      expect(await removeAccountant(teacherId)).toEqual({
        error: "Remove teachers from Teachers & Staff",
      });
      expect(await removeAccountant(user!.id)).toMatchObject({
        success: true,
      });
      expect(
        (await prisma.user.findUnique({ where: { id: user!.id } }))?.isActive,
      ).toBe(false);

      const restored = await createAccountant({ name: "Ravi Accounts", email });
      expect(restored).toMatchObject({ success: true, reactivated: true });
    });
  });
});
