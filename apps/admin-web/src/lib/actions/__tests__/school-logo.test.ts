import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { updateSchoolLogo } from "../settings";

const suffix = Math.random().toString(36).substring(7);
const schoolId = `logo-test-school-${suffix}`;
const LOGO = "https://res.cloudinary.com/demo/image/upload/v1/kora_logos/a.png";

const signInAs = (id: string, role: string) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId, role },
  } as any);

describe("school logo", () => {
  let adminId: string;
  let teacherId: string;

  beforeAll(async () => {
    await prisma.school.create({
      data: { id: schoolId, name: "Logo School", subdomain: schoolId },
    });
    const user = (role: "SCHOOL_ADMIN" | "TEACHER") =>
      prisma.user.create({
        data: {
          email: `logo-${role.toLowerCase()}-${suffix}@test.com`,
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
    await prisma.activityLog.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.deleteMany({ where: { id: schoolId } });
  });

  const savedLogo = async () =>
    (await prisma.school.findUniqueOrThrow({ where: { id: schoolId } }))
      .logoUrl;

  it("lets the school admin change and remove the logo", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    expect(await updateSchoolLogo(LOGO)).toEqual({ success: true });
    expect(await savedLogo()).toBe(LOGO);

    expect(await updateSchoolLogo(null)).toEqual({ success: true });
    expect(await savedLogo()).toBeNull();
  });

  it.each([
    ["another site's image", "https://example.com/logo.png"],
    ["plain http", "http://res.cloudinary.com/demo/image/upload/a.png"],
    ["a script address", "javascript:alert(1)"],
    ["a data address", "data:image/png;base64,AAAA"],
    ["not an image upload", "https://res.cloudinary.com/demo/raw/upload/a.png"],
  ])("refuses %s", async (_, url) => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const result = await updateSchoolLogo(url);
    expect(result).toHaveProperty("error");
    expect(await savedLogo()).toBeNull();
  });

  it("doesn't let a teacher change the logo", async () => {
    signInAs(teacherId, "TEACHER");
    expect(await updateSchoolLogo(LOGO)).toHaveProperty("error");
    expect(await savedLogo()).toBeNull();
  });
});
