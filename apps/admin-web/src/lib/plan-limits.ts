import { prisma } from "@schoolos/db";
import { PLANS } from "@/lib/plans";

export interface PlanLimits {
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  analyticsEnabled: boolean;
}

// From the plan catalogue (U1); DB PlanLimit rows take precedence when seeded
const DEFAULT_LIMITS: Record<string, PlanLimits> = Object.fromEntries(
  Object.values(PLANS).map((p) => [p.id, { ...p.limits }]),
);

let cachedLimitsMap: Map<string, PlanLimits> | null = null;
let cachedLimitsAt = 0;

export async function getAllPlanLimitsMap(): Promise<Map<string, PlanLimits>> {
  const now = Date.now();
  if (cachedLimitsMap && now - cachedLimitsAt < 60_000) {
    return cachedLimitsMap;
  }
  const map = new Map<string, PlanLimits>();
  for (const [k, v] of Object.entries(DEFAULT_LIMITS)) {
    map.set(k, v);
  }
  try {
    const rows = await prisma.planLimit.findMany();
    for (const row of rows) {
      map.set(row.plan, {
        maxStudents: row.maxStudents,
        maxTeachers: row.maxTeachers,
        maxClasses: row.maxClasses,
        analyticsEnabled: row.analyticsEnabled,
      });
    }
  } catch {
    // fallback to defaults
  }
  cachedLimitsMap = map;
  cachedLimitsAt = now;
  return map;
}

export async function getPlanLimits(plan: string): Promise<PlanLimits> {
  const map = await getAllPlanLimitsMap();
  return map.get(plan) ?? DEFAULT_LIMITS[plan] ?? DEFAULT_LIMITS.FREE!;
}

export async function checkStudentLimit(
  schoolId: string,
): Promise<{ allowed: boolean; current: number; max: number; plan: string }> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      _count: { select: { students: { where: { isActive: true } } } },
    },
  });
  if (!school) return { allowed: false, current: 0, max: 0, plan: "FREE" };

  const limits = await getPlanLimits(school.plan);
  const current = school._count.students;
  return {
    allowed: current < limits.maxStudents,
    current,
    max: limits.maxStudents,
    plan: school.plan,
  };
}

export async function checkTeacherLimit(
  schoolId: string,
): Promise<{ allowed: boolean; current: number; max: number; plan: string }> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      _count: { select: { teachers: { where: { isActive: true } } } },
    },
  });
  if (!school) return { allowed: false, current: 0, max: 0, plan: "FREE" };

  const limits = await getPlanLimits(school.plan);
  const current = school._count.teachers;
  return {
    allowed: current < limits.maxTeachers,
    current,
    max: limits.maxTeachers,
    plan: school.plan,
  };
}

export async function checkClassLimit(
  schoolId: string,
): Promise<{ allowed: boolean; current: number; max: number; plan: string }> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { plan: true, _count: { select: { classes: true } } },
  });
  if (!school) return { allowed: false, current: 0, max: 0, plan: "FREE" };

  const limits = await getPlanLimits(school.plan);
  const current = school._count.classes;
  return {
    allowed: current < limits.maxClasses,
    current,
    max: limits.maxClasses,
    plan: school.plan,
  };
}

export function planLimitMessage(
  resource: string,
  current: number,
  max: number,
  plan: string,
): string {
  return `You've reached the ${plan} plan limit of ${max} ${resource}. Upgrade your plan to add more.`;
}
