import { z } from "zod";
import {
  PLAN_IDS,
  PLAN_MODULES,
  type FeatureKey,
  type PlanCatalog,
  type PlanDefinition,
  type PlanId,
} from "@/lib/plans";

/**
 * Editing a plan from the super admin's Subscriptions page (U1). The editor
 * and the server action check input with the same rules.
 */

export const MAX_PLAN_LIMIT = 1_000_000;
export const MAX_PLAN_PRICE_INR = 1_000_000;
export const MAX_BENEFITS = 12;

const wholeNumber = z.number({ invalid_type_error: "Enter a number" });

/** null means unlimited. */
const limit = wholeNumber
  .int("Use a whole number")
  .min(1, "At least 1")
  .max(MAX_PLAN_LIMIT, "Use Unlimited instead")
  .nullable();

const MODULE_KEYS = PLAN_MODULES.map((m) => m.key) as [
  FeatureKey,
  ...FeatureKey[],
];

export const PlanInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  tagline: z.string().trim().min(1, "Tagline is required").max(120),
  monthlyPriceInr: wholeNumber
    .int("Whole rupees only")
    .min(0)
    .max(MAX_PLAN_PRICE_INR),
  maxStudents: limit,
  maxTeachers: limit,
  maxClasses: limit,
  modules: z
    .array(z.enum(MODULE_KEYS))
    .transform((keys) => MODULE_KEYS.filter((k) => keys.includes(k))),
  features: z
    .array(z.string().trim().min(1, "Benefit can't be empty").max(120))
    .min(1, "Add at least one benefit")
    .max(MAX_BENEFITS, `At most ${MAX_BENEFITS} benefits`),
  popular: z.boolean(),
});

export type PlanInput = z.input<typeof PlanInputSchema>;
export type ParsedPlanInput = z.output<typeof PlanInputSchema>;

/** Field path ("name", "features.2") to its first problem. */
export type PlanFieldErrors = Record<string, string>;

const failure = (fieldErrors: PlanFieldErrors) => ({
  error: Object.values(fieldErrors)[0],
  fieldErrors,
});

/** Checks `input` for plan `id`: Free stays free, paid plans cost at least ₹1. */
export function parsePlanInput(
  id: PlanId,
  input: unknown,
): { data: ParsedPlanInput } | { error: string; fieldErrors: PlanFieldErrors } {
  const parsed = PlanInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: PlanFieldErrors = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "plan"] ??= issue.message;
    }
    return failure(fieldErrors);
  }
  const data = parsed.data;
  if (id === "FREE" && data.monthlyPriceInr !== 0) {
    return failure({ monthlyPriceInr: "The Free plan can't have a price" });
  }
  if (id === "FREE" && data.popular) {
    return failure({ popular: "Only a paid plan can be marked most popular" });
  }
  // Razorpay's smallest charge is ₹1.
  if (id !== "FREE" && data.monthlyPriceInr < 1) {
    return failure({
      monthlyPriceInr: "A paid plan costs at least ₹1 a month",
    });
  }
  return { data };
}

const toLimit = (n: number) => (Number.isFinite(n) ? n : null);
const fromLimit = (n: number | null) => n ?? Infinity;

/** The editor's starting values for `plan`. */
export function planToInput(plan: PlanDefinition): PlanInput {
  return {
    name: plan.name,
    tagline: plan.tagline,
    monthlyPriceInr: plan.monthlyPriceInr,
    maxStudents: toLimit(plan.limits.maxStudents),
    maxTeachers: toLimit(plan.limits.maxTeachers),
    maxClasses: toLimit(plan.limits.maxClasses),
    modules: [...plan.modules],
    features: [...plan.features],
    popular: Boolean(plan.popular),
  };
}

/** The catalogue with plan `id` replaced. Only one plan stays most popular. */
export function applyPlanInput(
  plans: PlanCatalog,
  id: PlanId,
  data: ParsedPlanInput,
): PlanCatalog {
  const next = { ...plans };
  next[id] = {
    id,
    name: data.name,
    tagline: data.tagline,
    monthlyPriceInr: data.monthlyPriceInr,
    limits: {
      maxStudents: fromLimit(data.maxStudents),
      maxTeachers: fromLimit(data.maxTeachers),
      maxClasses: fromLimit(data.maxClasses),
    },
    modules: data.modules,
    features: data.features,
    popular: data.popular,
  };
  if (data.popular) {
    for (const other of PLAN_IDS) {
      if (other !== id) next[other] = { ...next[other], popular: false };
    }
  }
  return next;
}

/** A `plan_configs` row's columns for `plan`. */
export function planToRow(plan: PlanDefinition) {
  return {
    name: plan.name,
    tagline: plan.tagline,
    monthlyPriceInr: plan.monthlyPriceInr,
    maxStudents: toLimit(plan.limits.maxStudents),
    maxTeachers: toLimit(plan.limits.maxTeachers),
    maxClasses: toLimit(plan.limits.maxClasses),
    modules: plan.modules,
    benefits: plan.features,
    popular: Boolean(plan.popular),
  };
}
