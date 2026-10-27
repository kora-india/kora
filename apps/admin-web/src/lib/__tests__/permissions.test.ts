import { describe, it, expect } from "vitest";
import {
  FULL_ACCESS,
  NO_ACCESS,
  PERMISSION_MODULES,
  PermissionsSchema,
  ROLE_DEFAULT_PERMISSIONS,
  UserRole,
  can,
  moduleLevels,
  permissionsProblem,
  resolvePermissions,
} from "@schoolos/types";

describe("resolvePermissions", () => {
  it("gives admins everything, whatever is stored", () => {
    for (const role of [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]) {
      expect(resolvePermissions(role, { fees: "none" })).toEqual(FULL_ACCESS);
    }
    expect(FULL_ACCESS.ledger).toBe("view");
    expect(FULL_ACCESS.fees).toBe("manage");
  });

  it("starts teachers where they were before permissions existed", () => {
    expect(resolvePermissions(UserRole.TEACHER, null)).toEqual({
      students: "view",
      classes: "none",
      staff: "none",
      attendance: "manage",
      timetable: "view",
      exams: "view",
      marks: "manage",
      assignments: "manage",
      notices: "manage",
      transport: "view",
      fees: "none",
      expenses: "none",
      ledger: "none",
      analytics: "none",
    });
  });

  it("starts accountants on the money", () => {
    const p = resolvePermissions(UserRole.ACCOUNTANT, null);
    expect(p).toMatchObject({
      students: "view",
      fees: "manage",
      expenses: "manage",
      ledger: "view",
      transport: "manage",
      attendance: "none",
      notices: "none",
      analytics: "none",
    });
  });

  it("applies what the admin saved over the role defaults", () => {
    const p = resolvePermissions(UserRole.TEACHER, {
      fees: "view",
      attendance: "none",
    });
    expect(p.fees).toBe("view");
    expect(p.attendance).toBe("none");
    // Not saved: the default stays.
    expect(p.marks).toBe("manage");
  });

  it("ignores levels a module doesn't offer and modules it doesn't know", () => {
    const p = resolvePermissions(UserRole.ACCOUNTANT, {
      ledger: "manage",
      analytics: "everything",
      library: "manage",
    });
    expect(p.ledger).toBe("view");
    expect(p.analytics).toBe("none");
    expect(p).not.toHaveProperty("library");
  });

  it("gives an unknown role nothing, whatever is stored", () => {
    expect(resolvePermissions("PARENT", { fees: "manage" })).toEqual(NO_ACCESS);
  });
});

describe("can", () => {
  const p = { ...NO_ACCESS, fees: "view", attendance: "manage" } as const;

  it("ranks none < view < manage", () => {
    expect(can(p, "fees")).toBe(true);
    expect(can(p, "fees", "manage")).toBe(false);
    expect(can(p, "attendance", "view")).toBe(true);
    expect(can(p, "attendance", "manage")).toBe(true);
    expect(can(p, "ledger")).toBe(false);
  });
});

describe("the editor's rules", () => {
  const teacher = ROLE_DEFAULT_PERMISSIONS[UserRole.TEACHER];

  it("offers manage only where there is something to change", () => {
    expect(moduleLevels("ledger")).toEqual(["none", "view"]);
    expect(moduleLevels("analytics")).toEqual(["none", "view"]);
    expect(moduleLevels("fees")).toEqual(["none", "view", "manage"]);
  });

  it("needs every module, at a level it offers", () => {
    expect(PermissionsSchema.safeParse(teacher).success).toBe(true);
    expect(
      PermissionsSchema.safeParse({ ...teacher, ledger: "manage" }).success,
    ).toBe(false);
    const { fees: _fees, ...missingFees } = teacher;
    expect(PermissionsSchema.safeParse(missingFees).success).toBe(false);
    expect(Object.keys(teacher)).toHaveLength(PERMISSION_MODULES.length);
  });

  it("won't allow marks entry without the exam list", () => {
    expect(permissionsProblem(teacher)).toBeNull();
    expect(permissionsProblem({ ...teacher, exams: "none" })).toBe(
      "Marks entry needs Exams set to View or Manage",
    );
    expect(
      permissionsProblem({ ...teacher, exams: "none", marks: "none" }),
    ).toBeNull();
  });
});
