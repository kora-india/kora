import { z } from "zod";
import { UserRole } from "./enums";

/**
 * Per-person permissions. The school admin sets, for each teacher or
 * accountant login, what they may see (view) and change (manage) in each
 * module. Until the admin saves someone's permissions, their role's defaults
 * apply: what that role could do before permissions existed. School admins
 * and the super admin always have full access.
 *
 * Permissions decide which modules a person may use. Rules about whose
 * records a teacher may touch (their own sections, notices and assignments)
 * still apply on top.
 */

export type AccessLevel = "none" | "view" | "manage";

export const PERMISSION_MODULES = [
  {
    key: "students",
    label: "Students",
    view: "See the student list",
    manage: "Open profiles; add, edit, import and remove students",
  },
  {
    key: "classes",
    label: "Classes & sections",
    view: "See classes and sections",
    manage: "Create and change classes and sections",
  },
  {
    key: "staff",
    label: "Teachers & staff",
    view: "See teachers and staff, without pay",
    manage: "Add, edit and remove teachers and staff, and see their pay",
  },
  {
    key: "attendance",
    label: "Attendance",
    view: "See attendance",
    manage: "Mark attendance; teachers only for their sections",
  },
  {
    key: "timetable",
    label: "Timetable",
    view: "See timetables",
    manage: "Edit and generate timetables",
  },
  {
    key: "exams",
    label: "Exams",
    view: "See exams and results",
    manage: "Create, edit and publish exams",
  },
  {
    key: "marks",
    label: "Marks entry",
    view: "See marks sheets",
    manage: "Enter marks; teachers only for their subjects",
  },
  {
    key: "assignments",
    label: "Assignments",
    view: "See assignments",
    manage: "Set assignments; teachers change only their own",
  },
  {
    key: "notices",
    label: "Notices",
    view: "Read notices",
    manage: "Post notices; teachers change only their own",
  },
  {
    key: "transport",
    label: "Transport",
    view: "See vehicles, routes and riders",
    manage: "Manage vehicles, routes and enrolments",
  },
  {
    key: "fees",
    label: "Fees",
    view: "See fee dues, payments and receipts",
    manage: "Collect payments, generate fees and change fee settings",
  },
  {
    key: "expenses",
    label: "Expenses",
    view: "See expenses",
    manage: "Record and change expenses",
  },
  {
    key: "ledger",
    label: "Ledger",
    view: "See the income and expense ledger",
    manage: null,
  },
  {
    key: "analytics",
    label: "Analytics",
    view: "See school analytics, including revenue",
    manage: null,
  },
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number]["key"];
export type Permissions = Record<PermissionModule, AccessLevel>;

/** Roles whose permissions the school admin sets. */
export type StaffRole = UserRole.TEACHER | UserRole.ACCOUNTANT;

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, manage: 2 };

// Modules with nothing to change (ledger, analytics) stop at view.
const everyModule = (level: AccessLevel) =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [
      m.key,
      level === "manage" && !m.manage ? "view" : level,
    ]),
  ) as Permissions;

export const FULL_ACCESS: Permissions = everyModule("manage");
export const NO_ACCESS: Permissions = everyModule("none");

/** What each role could do before permissions existed. */
export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, Permissions> = {
  [UserRole.TEACHER]: {
    ...NO_ACCESS,
    students: "view",
    attendance: "manage",
    timetable: "view",
    exams: "view",
    marks: "manage",
    assignments: "manage",
    notices: "manage",
    transport: "view",
  },
  [UserRole.ACCOUNTANT]: {
    ...NO_ACCESS,
    students: "view",
    transport: "manage",
    fees: "manage",
    expenses: "manage",
    ledger: "view",
  },
};

export function isStaffRole(role: string): role is StaffRole {
  return role === UserRole.TEACHER || role === UserRole.ACCOUNTANT;
}

/** The levels a module offers. */
export function moduleLevels(module: PermissionModule): AccessLevel[] {
  const definition = PERMISSION_MODULES.find((m) => m.key === module);
  return definition?.manage ? ["none", "view", "manage"] : ["none", "view"];
}

/**
 * A person's permissions: full for admins, otherwise what the school admin
 * saved (`stored`) over their role's defaults. Unknown modules and levels a
 * module doesn't offer are ignored, so a module added later starts at the
 * role default.
 */
export function resolvePermissions(
  role: UserRole | string,
  stored: unknown,
): Permissions {
  if (role === UserRole.SUPER_ADMIN || role === UserRole.SCHOOL_ADMIN) {
    return { ...FULL_ACCESS };
  }
  if (!isStaffRole(role)) return { ...NO_ACCESS };
  const permissions = { ...ROLE_DEFAULT_PERMISSIONS[role] };
  if (stored && typeof stored === "object") {
    for (const { key } of PERMISSION_MODULES) {
      const level = (stored as Record<string, unknown>)[key];
      if (moduleLevels(key).includes(level as AccessLevel)) {
        permissions[key] = level as AccessLevel;
      }
    }
  }
  return permissions;
}

/** True when `permissions` allow at least `level` in `module`. */
export function can(
  permissions: Permissions,
  module: PermissionModule,
  level: Exclude<AccessLevel, "none"> = "view",
) {
  return RANK[permissions[module]] >= RANK[level];
}

/** A combination that can't work, in words; null when there's none. */
export function permissionsProblem(permissions: Permissions): string | null {
  // Marks are entered from the exam list.
  if (permissions.marks !== "none" && permissions.exams === "none") {
    return "Marks entry needs Exams set to View or Manage";
  }
  return null;
}

/** What the permissions editor sends; every module must be present. */
export const PermissionsSchema = z.object(
  Object.fromEntries(
    PERMISSION_MODULES.map(({ key }) => [
      key,
      z.enum(moduleLevels(key) as [AccessLevel, ...AccessLevel[]]),
    ]),
  ) as Record<PermissionModule, z.ZodEnum<[AccessLevel, ...AccessLevel[]]>>,
);
