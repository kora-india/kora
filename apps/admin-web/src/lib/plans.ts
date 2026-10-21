/**
 * The plan catalogue (U1). Every price, limit and feature list shown to
 * schools, charged at checkout or enforced by the limit checks comes from
 * here, so the landing page, setup, billing and super-admin screens agree.
 *
 * Feature lists only name what the app gates and ships: transport needs
 * Basic, exams, timetable and analytics need Pro (see `hasFeatureAccess`).
 * Limits can still be overridden per plan by `plan_limits` rows.
 */

export type PaidPlanId = "BASIC" | "PRO" | "ENTERPRISE";
export type PlanId = "FREE" | PaidPlanId;

export interface PlanLimitsDefinition {
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  analyticsEnabled: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Monthly price in rupees. */
  monthlyPriceInr: number;
  tagline: string;
  limits: PlanLimitsDefinition;
  features: string[];
  popular?: boolean;
}

export const TRIAL_PLAN: PaidPlanId = "PRO";

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    monthlyPriceInr: 0,
    tagline: "For trying Kora with a small group.",
    limits: {
      maxStudents: 50,
      maxTeachers: 5,
      maxClasses: 5,
      analyticsEnabled: false,
    },
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
      analyticsEnabled: false,
    },
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
      analyticsEnabled: true,
    },
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
      analyticsEnabled: true,
    },
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

export const isPaidPlan = (plan: string): plan is PaidPlanId =>
  (PAID_PLAN_IDS as string[]).includes(plan);

export const getPlan = (plan: string | null | undefined): PlanDefinition =>
  PLANS[(plan as PlanId) ?? "FREE"] ?? PLANS.FREE;

/** "₹1,999" */
export const formatPlanPrice = (plan: PlanDefinition) =>
  `₹${plan.monthlyPriceInr.toLocaleString("en-IN")}`;

/** "2,000" or "Unlimited" */
export const formatLimit = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN") : "Unlimited";

/** Razorpay amounts are in paise. */
export const planAmountPaise = (plan: PaidPlanId) =>
  PLANS[plan].monthlyPriceInr * 100;
