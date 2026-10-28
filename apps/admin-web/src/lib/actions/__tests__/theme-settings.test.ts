import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { updateSchoolThemeColor } from "../settings";
import { saveColorMode } from "../account";

const suffix = Math.random().toString(36).substring(7);
const schoolId = `theme-test-school-${suffix}`;

const signInAs = (id: string, role: string) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId, role },
  } as any);

describe("theme settings", () => {
  let adminId: string;
  let teacherId: string;

  beforeAll(async () => {
    await prisma.school.create({
      data: { id: schoolId, name: "Theme School", subdomain: schoolId },
    });
    const user = (role: "SCHOOL_ADMIN" | "TEACHER") =>
      prisma.user.create({
        data: {
          email: `${role.toLowerCase()}-${suffix}@test.com`,
          name: role,
          password: "hash",
          role,
          schoolId,
        },
      });
    adminId = (await user("SCHOOL_ADMIN")).id;
    teacherId = (await user("TEACHER")).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.deleteMany({ where: { id: schoolId } });
  });

  const savedColor = async () =>
    (await prisma.school.findUniqueOrThrow({ where: { id: schoolId } }))
      .themeColor;

  it("lets the school admin pick one of the theme colors", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    expect(await updateSchoolThemeColor("teal")).toEqual({ success: true });
    expect(await savedColor()).toBe("teal");

    expect(await updateSchoolThemeColor("#ff0000")).toEqual({
      error: "Choose one of the theme colors",
    });
    expect(await savedColor()).toBe("teal");
  });

  it("doesn't let a teacher change the school's color", async () => {
    signInAs(teacherId, "TEACHER");
    expect(await updateSchoolThemeColor("orange")).toMatchObject({
      error: expect.stringMatching(/permission/i),
    });
    expect(await savedColor()).toBe("teal");
  });

  it("saves each person's light/dark choice to their own account", async () => {
    signInAs(teacherId, "TEACHER");
    expect(await saveColorMode("dark")).toEqual({ success: true });
    expect(await saveColorMode("sepia")).toEqual({
      error: "Choose light, dark or system",
    });

    const [teacher, admin] = await Promise.all(
      [teacherId, adminId].map((id) =>
        prisma.user.findUniqueOrThrow({ where: { id } }),
      ),
    );
    expect(teacher.colorMode).toBe("dark");
    expect(admin.colorMode).toBeNull();
  });

  it("changes nothing without a session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    expect(await saveColorMode("light")).toEqual({ error: "Unauthorized" });
    expect(await updateSchoolThemeColor("blue")).toEqual({
      error: "Unauthorized",
    });
  });
});
