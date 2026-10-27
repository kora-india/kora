/**
 * The plan catalogue (U1). Every price, limit, module and benefit shown to
 * schools, charged at checkout or enforced by the limit and feature checks
 * comes from one catalogue, so the landing page, setup, billing and
 * super-admin screens agree.
 *
 * The super admin edits plans from the Subscriptions page; the server loads
 * the live catalogue with `getPlanCatalog()` (lib/plan-catalog.ts) and hands
 * it to these helpers. `DEFAULT_PLANS` applies until the first edit.
 */

export type PaidPlanId = "BASIC" | "PRO" | "ENTERPRISE";
export type PlanId = "FREE" | PaidPlanId;

/** Modules a plan has to include before a school can open them. */
export type FeatureKey = "TRANSPORT" | "EXAMS" | "TIMETABLE" | "ANALYTICS";

export const PLAN_MODULES: { key: FeatureKey; label: string }[] = [
  { key: "TRANSPORT", label: "Transport & bus fees" },
  { key: "EXAMS", label: "Exams & report cards" },
  { key: "TIMETABLE", label: "Timetable" },
  { key: "ANALYTICS", label: "Analytics & reports" },
];

export interface PlanLimitsDefinition {
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Monthly price in rupees. */
  monthlyPriceInr: number;
  tagline: string;
  /** `Infinity` means unlimited. */
  limits: PlanLimitsDefinition;
  modules: FeatureKey[];
  /** Benefit lines shown wherever the plan is offered. */
  features: string[];
  popular?: boolean;
}

export type PlanCatalog = Record<PlanId, PlanDefinition>;
export type PaidPlanDefinition = PlanDefinition & { id: PaidPlanId };

export const TRIAL_PLAN: PaidPlanId = "PRO";
export const TRIAL_DURATION_DAYS = 14;

export const DEFAULT_PLANS: PlanCatalog = {
  FREE: {
    id: "FREE",
    name: "Free",
    monthlyPriceInr: 0,
    tagline: "For trying Kora with a small group.",
    limits: {
      maxStudents: 50,
      maxTeachers: 5,
      maxClasses: 5,
    },
    modules: [],
    features: [
      "Up to 50 students",
      "Student & teacher records",
      "Daily attendance",
      "Fee receipts",
      "Notices",
    ],
  },
  BASIC: {
    id: "BASIC",
    name: "Basic",
    monthlyPriceInr: 999,
    tagline: "For small schools getting started.",
    limits: {
      maxStudents: 500,
      maxTeachers: 20,
      maxClasses: 20,
    },
    modules: ["TRANSPORT"],
    features: [
      "Up to 500 students",
      "Student, staff & attendance management",
      "Fee collection, receipts & dues",
      "Transport routes & bus fees",
      "Notices, homework & expenses",
      "Email support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    monthlyPriceInr: 1999,
    tagline: "For growing schools that want the full toolkit.",
    popular: true,
    limits: {
      maxStudents: 2000,
      maxTeachers: 100,
      maxClasses: 60,
    },
    modules: ["TRANSPORT", "EXAMS", "TIMETABLE", "ANALYTICS"],
    features: [
      "Up to 2,000 students",
      "Everything in Basic",
      "Exams & report cards",
      "Timetable with AI scheduling",
      "Analytics & financial reports",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    monthlyPriceInr: 4999,
    tagline: "For large schools and school groups.",
    limits: {
      maxStudents: Infinity,
      maxTeachers: Infinity,
      maxClasses: Infinity,
    },
    modules: ["TRANSPORT", "EXAMS", "TIMETABLE", "ANALYTICS"],
    features: [
      "Unlimited students, teachers & classes",
      "Everything in Pro",
      "Help moving data from your old software",
      "Dedicated account manager",
      "Priority phone support",
    ],
  },
};

export const PAID_PLAN_IDS: PaidPlanId[] = ["BASIC", "PRO", "ENTERPRISE"];
export const PLAN_IDS: PlanId[] = ["FREE", ...PAID_PLAN_IDS];

export const isPlanId = (plan: string): plan is PlanId =>
  (PLAN_IDS as string[]).includes(plan);

export const isPaidPlan = (plan: string): plan is PaidPlanId =>
  (PAID_PLAN_IDS as string[]).includes(plan);

export const getPlan = (
  plans: PlanCatalog,
  plan: string | null | undefined,
): PlanDefinition =>
  (plan && isPlanId(plan) ? plans[plan] : undefined) ?? plans.FREE;

/** Paid plans from cheapest to dearest. */
export const paidPlansByPrice = (plans: PlanCatalog): PaidPlanDefinition[] =>
  PAID_PLAN_IDS.map((id) => ({ ...plans[id], id })).sort(
    (a, b) => a.monthlyPriceInr - b.monthlyPriceInr,
  );

export const planIncludes = (plan: PlanDefinition, feature: FeatureKey) =>
  plan.modules.includes(feature);

/** The cheapest paid plan that unlocks `feature`, or null when none does. */
export const cheapestPlanWith = (
  plans: PlanCatalog,
  feature: FeatureKey,
): PaidPlanDefinition | null =>
  paidPlansByPrice(plans).find((p) => planIncludes(p, feature)) ?? null;

/** "₹1,999" */
export const formatPlanPrice = (plan: PlanDefinition) =>
  `₹${plan.monthlyPriceInr.toLocaleString("en-IN")}`;

/** "2,000" or "Unlimited" */
export const formatLimit = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN") : "Unlimited";

/** Razorpay amounts are in paise. */
export const planAmountPaise = (plan: PlanDefinition) =>
  plan.monthlyPriceInr * 100;
