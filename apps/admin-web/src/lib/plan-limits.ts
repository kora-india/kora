import { prisma } from "@schoolos/db";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { PLAN_IDS, getPlan, type PlanDefinition } from "@/lib/plans";

export interface PlanLimits {
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  analyticsEnabled: boolean;
}

// From the live plan catalogue (U1), which the super admin edits
const toLimits = (plan: PlanDefinition): PlanLimits => ({
  ...plan.limits,
  analyticsEnabled: plan.modules.includes("ANALYTICS"),
});

export async function getAllPlanLimitsMap(): Promise<Map<string, PlanLimits>> {
  const plans = await getPlanCatalog();
  return new Map(PLAN_IDS.map((id) => [id, toLimits(plans[id])]));
}

export async function getPlanLimits(plan: string): Promise<PlanLimits> {
  return toLimits(getPlan(await getPlanCatalog(), plan));
}

type LimitCheck = {
  allowed: boolean;
  current: number;
  max: number;
  plan: string;
  /** The plan's display name, for messages. */
  planName: string;
};

async function limitCheck(
  plan: string,
  current: number,
  key: keyof PlanDefinition["limits"],
): Promise<LimitCheck> {
  const def = getPlan(await getPlanCatalog(), plan);
  const max = def.limits[key];
  return { allowed: current < max, current, max, plan, planName: def.name };
}

const NO_SCHOOL: LimitCheck = {
  allowed: false,
  current: 0,
  max: 0,
  plan: "FREE",
  planName: "Free",
};

export async function checkStudentLimit(schoolId: string): Promise<LimitCheck> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      _count: { select: { students: { where: { isActive: true } } } },
    },
  });
  if (!school) return NO_SCHOOL;
  return limitCheck(school.plan, school._count.students, "maxStudents");
}

export async function checkTeacherLimit(schoolId: string): Promise<LimitCheck> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      _count: { select: { teachers: { where: { isActive: true } } } },
    },
  });
  if (!school) return NO_SCHOOL;
  return limitCheck(school.plan, school._count.teachers, "maxTeachers");
}

export async function checkClassLimit(schoolId: string): Promise<LimitCheck> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { plan: true, _count: { select: { classes: true } } },
  });
  if (!school) return NO_SCHOOL;
  return limitCheck(school.plan, school._count.classes, "maxClasses");
}

export function planLimitMessage(
  resource: string,
  current: number,
  max: number,
  planName: string,
): string {
  return `You've reached the ${planName} plan limit of ${max} ${resource}. Upgrade your plan to add more.`;
}
