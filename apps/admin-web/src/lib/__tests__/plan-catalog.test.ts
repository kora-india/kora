import { describe, it, expect } from "vitest";
import { buildPlanCatalog, type PlanConfigRow } from "../plan-catalog";
import {
  applyPlanInput,
  parsePlanInput,
  planToInput,
  planToRow,
  type PlanInput,
} from "../plan-input";
import {
  DEFAULT_PLANS,
  cheapestPlanWith,
  paidPlansByPrice,
  type PlanCatalog,
} from "../plans";
import { recommendedPlan } from "@/components/setup/setup-model";

const row = (overrides: Partial<PlanConfigRow> = {}): PlanConfigRow => ({
  plan: "BASIC",
  name: "Starter",
  tagline: "For small schools.",
  monthlyPriceInr: 799,
  maxStudents: 300,
  maxTeachers: 15,
  maxClasses: null,
  modules: ["TRANSPORT"],
  benefits: ["Up to 300 students"],
  popular: false,
  ...overrides,
});

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  ...planToInput(DEFAULT_PLANS.BASIC),
  ...overrides,
});

describe("buildPlanCatalog", () => {
  it("uses the defaults until a plan is saved", () => {
    expect(buildPlanCatalog([])).toEqual(DEFAULT_PLANS);
  });

  it("replaces a saved plan; null limits are unlimited", () => {
    const plans = buildPlanCatalog([row()]);
    expect(plans.BASIC).toEqual({
      id: "BASIC",
      name: "Starter",
      tagline: "For small schools.",
      monthlyPriceInr: 799,
      limits: { maxStudents: 300, maxTeachers: 15, maxClasses: Infinity },
      modules: ["TRANSPORT"],
      features: ["Up to 300 students"],
      popular: false,
    });
    expect(plans.PRO).toEqual(DEFAULT_PLANS.PRO);
  });

  it("drops modules and plans it doesn't know", () => {
    const plans = buildPlanCatalog([
      row({ modules: ["EXAMS", "LIBRARY"] }),
      row({ plan: "PLATINUM" }),
    ]);
    expect(plans.BASIC.modules).toEqual(["EXAMS"]);
    expect(Object.keys(plans)).toEqual(["FREE", "BASIC", "PRO", "ENTERPRISE"]);
  });

  it("still applies old plan_limits rows to plans never saved", () => {
    const plans = buildPlanCatalog(
      [row()],
      [
        { plan: "PRO", maxStudents: 2500, maxTeachers: 120, maxClasses: 70 },
        { plan: "BASIC", maxStudents: 1, maxTeachers: 1, maxClasses: 1 },
      ],
    );
    expect(plans.PRO.limits).toEqual({
      maxStudents: 2500,
      maxTeachers: 120,
      maxClasses: 70,
    });
    // The saved row wins over the old limits.
    expect(plans.BASIC.limits.maxStudents).toBe(300);
  });

  it("doesn't change the defaults it starts from", () => {
    buildPlanCatalog(
      [],
      [{ plan: "FREE", maxStudents: 1, maxTeachers: 1, maxClasses: 1 }],
    );
    expect(DEFAULT_PLANS.FREE.limits.maxStudents).toBe(50);
  });
});

describe("parsePlanInput", () => {
  it("accepts a valid plan and trims its text", () => {
    const result = parsePlanInput(
      "BASIC",
      input({ name: "  Starter ", features: [" Fees ", "Notices"] }),
    );
    expect(result).toMatchObject({
      data: { name: "Starter", features: ["Fees", "Notices"] },
    });
  });

  it("keeps modules in catalogue order without repeats", () => {
    const result = parsePlanInput(
      "PRO",
      input({ modules: ["ANALYTICS", "TRANSPORT", "ANALYTICS"] }),
    );
    expect("data" in result && result.data.modules).toEqual([
      "TRANSPORT",
      "ANALYTICS",
    ]);
  });

  it("reports each bad field under its own name", () => {
    const result = parsePlanInput(
      "BASIC",
      input({ name: "", maxStudents: NaN, features: ["Fees", "  "] }),
    );
    expect(result).toMatchObject({
      fieldErrors: {
        name: "Name is required",
        maxStudents: "Enter a number",
        "features.1": "Benefit can't be empty",
      },
    });
  });

  it("needs at least one benefit", () => {
    expect(parsePlanInput("BASIC", input({ features: [] }))).toMatchObject({
      fieldErrors: { features: "Add at least one benefit" },
    });
  });

  it("keeps Free free and never most popular", () => {
    const free = planToInput(DEFAULT_PLANS.FREE);
    expect(
      parsePlanInput("FREE", { ...free, monthlyPriceInr: 99 }),
    ).toMatchObject({ fieldErrors: { monthlyPriceInr: expect.any(String) } });
    expect(parsePlanInput("FREE", { ...free, popular: true })).toMatchObject({
      fieldErrors: { popular: expect.any(String) },
    });
  });

  it("charges at least ₹1 for a paid plan", () => {
    expect(parsePlanInput("PRO", input({ monthlyPriceInr: 0 }))).toMatchObject({
      error: "A paid plan costs at least ₹1 a month",
    });
  });
});

describe("applyPlanInput", () => {
  const parse = (overrides: Partial<PlanInput>) => {
    const result = parsePlanInput("BASIC", input(overrides));
    if (!("data" in result)) throw new Error(result.error);
    return result.data;
  };

  it("leaves one plan most popular", () => {
    const plans = applyPlanInput(
      DEFAULT_PLANS,
      "BASIC",
      parse({ popular: true }),
    );
    expect(plans.BASIC.popular).toBe(true);
    expect(plans.PRO.popular).toBe(false);
    expect(DEFAULT_PLANS.PRO.popular).toBe(true);
  });

  it("stores unlimited as null and reads it back as Infinity", () => {
    const plans = applyPlanInput(
      DEFAULT_PLANS,
      "BASIC",
      parse({ maxClasses: null }),
    );
    expect(plans.BASIC.limits.maxClasses).toBe(Infinity);
    expect(planToRow(plans.BASIC).maxClasses).toBeNull();
    expect(planToInput(plans.BASIC).maxClasses).toBeNull();
  });
});

describe("plans by price", () => {
  // Basic repriced above Pro, with exams moved down to it.
  const repriced: PlanCatalog = {
    ...DEFAULT_PLANS,
    BASIC: {
      ...DEFAULT_PLANS.BASIC,
      monthlyPriceInr: 2499,
      modules: ["TRANSPORT", "EXAMS"],
    },
    PRO: { ...DEFAULT_PLANS.PRO, modules: ["TRANSPORT"] },
  };

  it("lists paid plans cheapest first", () => {
    expect(paidPlansByPrice(repriced).map((p) => p.id)).toEqual([
      "PRO",
      "BASIC",
      "ENTERPRISE",
    ]);
  });

  it("names the cheapest plan that unlocks a module", () => {
    expect(cheapestPlanWith(DEFAULT_PLANS, "TRANSPORT")?.id).toBe("BASIC");
    expect(cheapestPlanWith(repriced, "EXAMS")?.id).toBe("BASIC");
    expect(cheapestPlanWith(repriced, "TRANSPORT")?.id).toBe("PRO");
  });

  it("has no plan to offer when none unlocks the module", () => {
    const none: PlanCatalog = {
      ...DEFAULT_PLANS,
      PRO: { ...DEFAULT_PLANS.PRO, modules: [] },
      ENTERPRISE: { ...DEFAULT_PLANS.ENTERPRISE, modules: [] },
    };
    expect(cheapestPlanWith(none, "ANALYTICS")).toBeNull();
  });

  it("recommends the cheapest plan with room at setup", () => {
    // Pro (now cheapest) holds 2,000 students.
    expect(recommendedPlan(repriced, 400)).toBe("PRO");
    expect(recommendedPlan(repriced, 5000)).toBe("ENTERPRISE");
  });
});
