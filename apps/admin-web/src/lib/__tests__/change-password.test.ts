import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { changeOwnPassword } from "@schoolos/auth/password";
import { changePassword } from "../actions/account";

const suffix = Math.random().toString(36).substring(7);
const TEMP = "Temp-password-1";

describe("changing your own password", () => {
  let userId: string;

  beforeAll(async () => {
    userId = (
      await prisma.user.create({
        data: {
          email: `new-teacher-${suffix}@test.com`,
          name: "New Teacher",
          password: await bcrypt.hash(TEMP, 4),
          role: "TEACHER",
          mustChangePassword: true,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  const change = (overrides: Record<string, string> = {}) =>
    changeOwnPassword(userId, {
      currentPassword: TEMP,
      newPassword: "My-own-password-2",
      confirmPassword: "My-own-password-2",
      ...overrides,
    });

  it("needs the current password and a different new one", async () => {
    expect(await change({ currentPassword: "wrong-password" })).toEqual({
      error: "Current password is incorrect",
    });
    expect(await change({ newPassword: TEMP, confirmPassword: TEMP })).toEqual({
      error: "Choose a password different from the current one",
    });
    expect(await change({ confirmPassword: "something-else" })).toEqual({
      error: "Passwords do not match",
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.mustChangePassword).toBe(true);
  });

  it("replaces a temporary password and stops asking for a new one", async () => {
    const before = new Date();
    expect(await change()).toEqual({ success: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("My-own-password-2", user.password)).toBe(true);
    // Signs out older sessions (packages/auth checks passwordChangedAt).
    expect(user.passwordChangedAt!.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
  });

  it("refuses a login that was turned off", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    expect(
      await changeOwnPassword(userId, {
        currentPassword: "My-own-password-2",
        newPassword: "Third-password-3",
        confirmPassword: "Third-password-3",
      }),
    ).toEqual({ error: "User not found" });
  });

  it("changes nothing without a session", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    expect(await changePassword({})).toEqual({ error: "Unauthorized" });
  });
});
