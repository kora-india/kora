import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  makeSoleSuperAdmin: vi.fn(),
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  findUnique: vi.fn(),
  update: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@schoolos/db/super-admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@schoolos/db/super-admin")>()),
  makeSoleSuperAdmin: mocks.makeSoleSuperAdmin,
}));
vi.mock("@schoolos/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findUnique,
      update: mocks.update,
    },
  },
}));
vi.mock("@schoolos/logger", () => ({ createLogger: () => mocks.log }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/mailer", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

import { syncSuperAdminFromEnv } from "../super-admin-sync";
import { changePassword } from "../actions/account";
import { requestPasswordReset, resetPassword } from "../actions/password-reset";

const ENV = {
  SUPER_ADMIN_EMAIL: "Owner@Kora.in",
  SUPER_ADMIN_PASSWORD: "Owner-pass-2026",
};

beforeEach(() => vi.clearAllMocks());

describe("syncSuperAdminFromEnv", () => {
  it("applies the env login on start and logs what changed", async () => {
    mocks.makeSoleSuperAdmin.mockResolvedValue({
      adminId: "owner",
      created: true,
      passwordChanged: false,
      removed: 1,
      changed: true,
    });

    await syncSuperAdminFromEnv(ENV);

    expect(mocks.makeSoleSuperAdmin).toHaveBeenCalledWith(expect.anything(), {
      email: "owner@kora.in",
      password: "Owner-pass-2026",
    });
    expect(mocks.log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@kora.in",
        removedOtherSuperAdmins: 1,
      }),
      "Super admin updated from the environment",
    );
  });

  it("stays quiet when nothing changed", async () => {
    mocks.makeSoleSuperAdmin.mockResolvedValue({ changed: false });
    await syncSuperAdminFromEnv(ENV);
    expect(mocks.log.info).not.toHaveBeenCalled();
  });

  it("does nothing when the super admin isn't configured", async () => {
    await syncSuperAdminFromEnv({});
    expect(mocks.makeSoleSuperAdmin).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a bad setting",
      { SUPER_ADMIN_EMAIL: "owner", SUPER_ADMIN_PASSWORD: "x" },
      null,
    ],
    [
      "a refused email",
      ENV,
      new Error("owner@kora.in is already a SCHOOL_ADMIN account"),
    ],
  ])("logs %s instead of crashing the server", async (_, env, failure) => {
    if (failure) mocks.makeSoleSuperAdmin.mockRejectedValue(failure);

    await expect(syncSuperAdminFromEnv(env)).resolves.toBeUndefined();
    expect(mocks.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(String) }),
      expect.stringContaining("left as it was"),
    );
  });
});

describe("the super admin's password can't be changed in the app", () => {
  const superAdminUser = {
    id: "test-user-id",
    email: "owner@kora.in",
    role: "SUPER_ADMIN",
    isActive: true,
    password: "hash",
    resetToken: "token-hash",
    resetTokenExpiry: new Date(Date.now() + 60_000),
  };

  it("refuses a change from Settings and points to the env", async () => {
    mocks.findUnique.mockResolvedValue(superAdminUser);

    const result = await changePassword({
      currentPassword: "Owner-pass-2026",
      newPassword: "Another-pass-1",
      confirmPassword: "Another-pass-1",
    });

    expect(result.error).toMatch(/SUPER_ADMIN_PASSWORD on the server/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sends no reset email but gives the usual reply", async () => {
    mocks.findUnique.mockResolvedValue(superAdminUser);

    const result = await requestPasswordReset({ email: "owner@kora.in" });

    expect(result).toMatchObject({ success: true });
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a reset link for the super admin", async () => {
    mocks.findUnique.mockResolvedValue(superAdminUser);

    const result = await resetPassword({
      token: "raw-token",
      newPassword: "Another-pass-1",
      confirmPassword: "Another-pass-1",
    });

    expect(result.error).toMatch(/invalid or has expired/);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
