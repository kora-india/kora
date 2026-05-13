import { prisma } from "@schoolos/db";

export interface PlanLimits {
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  analyticsEnabled: boolean;
}

// Hardcoded fallbacks — DB PlanLimit rows take precedence when seeded
const DEFAULT_LIMITS: Record<string, PlanLimits> = {
  FREE:       { maxStudents: 50,       maxTeachers: 5,   maxClasses: 5,  analyticsEnabled: false },
  BASIC:      { maxStudents: 200,      maxTeachers: 20,  maxClasses: 20, analyticsEnabled: false },
  PRO:        { maxStudents: 1000,     maxTeachers: 100, maxClasses: 60, analyticsEnabled: true  },
  ENTERPRISE: { maxStudents: Infinity, maxTeachers: Infinity, maxClasses: Infinity, analyticsEnabled: true },
};

export async function getPlanLimits(plan: string): Promise<PlanLimits> {
  try {
    const row = await prisma.planLimit.findUnique({ where: { plan: plan as any } });
    if (row) {
      return {
        maxStudents: row.maxStudents,
        maxTeachers: row.maxTeachers,
        maxClasses: row.maxClasses,
        analyticsEnabled: row.analyticsEnabled,
      };
    }
  } catch {
    // PlanLimit table may not exist yet in dev — fall through to defaults
  }
  return DEFAULT_LIMITS[plan] ?? DEFAULT_LIMITS.FREE!;
}

export async function checkStudentLimit(schoolId: string): Promise<{ allowed: boolean; current: number; max: number; plan: string }> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { plan: true, _count: { select: { students: { where: { isActive: true } } } } },
  });
  if (!school) return { allowed: false, current: 0, max: 0, plan: "FREE" };

  const limits = await getPlanLimits(school.plan);
  const current = school._count.students;
  return { allowed: current < limits.maxStudents, current, max: limits.maxStudents, plan: school.plan };
}

export async function checkTeacherLimit(schoolId: string): Promise<{ allowed: boolean; current: number; max: number; plan: string }> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { plan: true, _count: { select: { teachers: { where: { isActive: true } } } } },
  });
  if (!school) return { allowed: false, current: 0, max: 0, plan: "FREE" };

  const limits = await getPlanLimits(school.plan);
  const current = school._count.teachers;
  return { allowed: current < limits.maxTeachers, current, max: limits.maxTeachers, plan: school.plan };
}

export async function checkClassLimit(schoolId: string): Promise<{ allowed: boolean; current: number; max: number; plan: string }> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { plan: true, _count: { select: { classes: true } } },
  });
  if (!school) return { allowed: false, current: 0, max: 0, plan: "FREE" };

  const limits = await getPlanLimits(school.plan);
  const current = school._count.classes;
  return { allowed: current < limits.maxClasses, current, max: limits.maxClasses, plan: school.plan };
}

export function planLimitMessage(resource: string, current: number, max: number, plan: string): string {
  return `You've reached the ${plan} plan limit of ${max} ${resource}. Upgrade your plan to add more.`;
}
