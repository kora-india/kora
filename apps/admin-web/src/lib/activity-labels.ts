/**
 * Names the activity log and ledger show for modules and roles. Safe for the
 * browser; the writer is lib/activity.ts.
 */

export const ACTIVITY_MODULES = {
  auth: "Sign-in",
  students: "Students",
  classes: "Classes",
  attendance: "Attendance",
  exams: "Exams",
  fees: "Fees",
  expenses: "Expenses",
  ledger: "Ledger",
  payroll: "Payroll",
  staff: "Staff",
  transport: "Transport",
  timetable: "Timetable",
  notices: "Notices",
  assignments: "Assignments",
  settings: "Settings",
  subscription: "Subscription",
} as const;

export type ActivityModule = keyof typeof ACTIVITY_MODULES;

export const isActivityModule = (v: string): v is ActivityModule =>
  Object.prototype.hasOwnProperty.call(ACTIVITY_MODULES, v);

/** Role stored on an activity row for automatic jobs. */
export const SYSTEM_ROLE = "SYSTEM";
/** What the ledger shows for payments brought in from earlier records. */
export const IMPORTED_ROLE = "IMPORTED";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SCHOOL_ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  [SYSTEM_ROLE]: "System",
  [IMPORTED_ROLE]: "Imported",
};

export const roleLabel = (role: string | null | undefined) =>
  (role && ROLE_LABELS[role]) || "Staff";
