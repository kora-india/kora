"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { UserRole } from "@schoolos/types";
import { getPlanLimits } from "@/lib/plan-limits";

const TIER_PRICES: Record<string, number> = {
  FREE: 0,
  BASIC: 999,
  PRO: 2499,
  ENTERPRISE: 4999,
};

export async function getSuperAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    return null;
  }
  return session.user;
}

export async function getSuperAdminDashboardData() {
  const user = await getSuperAdminSession();
  if (!user) {
    throw new Error("Unauthorized — Super Admin access required");
  }

  // 1. School Counts
  const totalSchools = await prisma.school.count();
  const activeSchools = await prisma.school.count({ where: { isActive: true } });
  const suspendedSchools = totalSchools - activeSchools;

  // 2. Global Platform User Aggregates
  const totalStudents = await prisma.student.count({ where: { isActive: true } });
  const totalTeachers = await prisma.teacher.count({ where: { isActive: true } });
  const totalClasses = await prisma.class.count();

  // 3. Plan Distribution & Estimated MRR
  const schoolsByPlan = await prisma.school.groupBy({
    by: ["plan"],
    _count: { id: true },
  });

  const planCounts: Record<string, number> = {
    FREE: 0,
    BASIC: 0,
    PRO: 0,
    ENTERPRISE: 0,
  };

  let estimatedMRR = 0;
  for (const item of schoolsByPlan) {
    planCounts[item.plan] = item._count.id;
    estimatedMRR += item._count.id * (TIER_PRICES[item.plan] ?? 0);
  }

  const planDistribution = [
    { name: "Free Tier", plan: "FREE", count: planCounts.FREE, value: planCounts.FREE, price: 0 },
    { name: "Basic Plan", plan: "BASIC", count: planCounts.BASIC, value: planCounts.BASIC, price: 999 },
    { name: "Pro Plan", plan: "PRO", count: planCounts.PRO, value: planCounts.PRO, price: 2499 },
    { name: "Enterprise", plan: "ENTERPRISE", count: planCounts.ENTERPRISE, value: planCounts.ENTERPRISE, price: 4999 },
  ].filter(p => p.count > 0 || totalSchools === 0);

  // 4. Platform Total Fee Volume Processed by Schools
  const paymentAgg = await prisma.paymentTransaction.aggregate({
    where: { status: "SUCCESS" },
    _sum: { amount: true },
    _count: { id: true },
  });
  const totalFeeVolume = Number(paymentAgg._sum.amount ?? 0);
  const totalTransactionsCount = paymentAgg._count.id;

  // 5. Recent 6 Schools
  const recentSchools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      _count: {
        select: {
          students: { where: { isActive: true } },
          teachers: { where: { isActive: true } },
          classes: true,
        },
      },
    },
  });

  // Check quota for each recent school
  const recentSchoolsWithQuota = await Promise.all(
    recentSchools.map(async (school) => {
      const limits = await getPlanLimits(school.plan);
      const studentCount = school._count.students;
      const maxStudents = limits.maxStudents;
      const usagePercent = maxStudents === Infinity ? 0 : Math.min(100, Math.round((studentCount / maxStudents) * 100));
      return {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        email: school.email,
        phone: school.phone,
        plan: school.plan,
        isActive: school.isActive,
        createdAt: school.createdAt.toISOString(),
        studentCount,
        teacherCount: school._count.teachers,
        maxStudents,
        usagePercent,
      };
    })
  );

  // 6. Schools Near Limit (>80% Capacity)
  const allSchools = await prisma.school.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      subdomain: true,
      plan: true,
      _count: {
        select: { students: { where: { isActive: true } } },
      },
    },
  });

  const schoolsNearLimit: { id: string; name: string; plan: string; current: number; max: number; percent: number }[] = [];
  for (const s of allSchools) {
    const limits = await getPlanLimits(s.plan);
    if (limits.maxStudents !== Infinity) {
      const pct = Math.round((s._count.students / limits.maxStudents) * 100);
      if (pct >= 80) {
        schoolsNearLimit.push({
          id: s.id,
          name: s.name,
          plan: s.plan,
          current: s._count.students,
          max: limits.maxStudents,
          percent: pct,
        });
      }
    }
  }

  // 7. Monthly School Onboarding (Last 6 Months)
  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d), key: monthKey(d), count: 0, revenue: 0 };
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const pastSchools = await prisma.school.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, plan: true },
  });

  pastSchools.forEach((s) => {
    const key = monthKey(new Date(s.createdAt));
    const m = months.find((entry) => entry.key === key);
    if (m) {
      m.count += 1;
      m.revenue += TIER_PRICES[s.plan] ?? 0;
    }
  });

  const onboardingGrowth = months.map((m) => ({
    month: m.label,
    schools: m.count,
    mrr: m.revenue,
  }));

  return {
    stats: {
      totalSchools,
      activeSchools,
      suspendedSchools,
      totalStudents,
      totalTeachers,
      totalClasses,
      estimatedMRR,
      estimatedARR: estimatedMRR * 12,
      totalFeeVolume,
      totalTransactionsCount,
    },
    planDistribution,
    recentSchools: recentSchoolsWithQuota,
    schoolsNearLimit,
    onboardingGrowth,
  };
}

export async function getSuperAdminAnalyticsData() {
  const user = await getSuperAdminSession();
  if (!user) {
    throw new Error("Unauthorized — Super Admin access required");
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // 1. Total schools & users
  const totalSchools = await prisma.school.count();
  const totalStudents = await prisma.student.count({ where: { isActive: true } });
  const totalTeachers = await prisma.teacher.count({ where: { isActive: true } });
  const totalStaff = await prisma.staff.count({ where: { isActive: true } });

  // 2. Module adoption rate (How many schools use each feature)
  const schoolsWithStudents = await prisma.school.count({ where: { students: { some: {} } } });
  const schoolsWithAttendance = await prisma.school.count({ where: { attendances: { some: {} } } });
  const schoolsWithFees = await prisma.school.count({ where: { feeCharges: { some: {} } } });
  const schoolsWithNotices = await prisma.school.count({ where: { notices: { some: {} } } });
  const schoolsWithAssignments = await prisma.school.count({ where: { assignments: { some: {} } } });
  const schoolsWithExpenses = await prisma.school.count({ where: { expenses: { some: {} } } });

  const calculatePct = (count: number) => (totalSchools > 0 ? Math.round((count / totalSchools) * 100) : 0);

  const moduleAdoption = [
    { module: "Student Directory", count: schoolsWithStudents, percentage: calculatePct(schoolsWithStudents), color: "bg-blue-500" },
    { module: "Fee Management", count: schoolsWithFees, percentage: calculatePct(schoolsWithFees), color: "bg-violet-500" },
    { module: "Daily Attendance", count: schoolsWithAttendance, percentage: calculatePct(schoolsWithAttendance), color: "bg-emerald-500" },
    { module: "Notice Broadcasts", count: schoolsWithNotices, percentage: calculatePct(schoolsWithNotices), color: "bg-amber-500" },
    { module: "Homework & Assignments", count: schoolsWithAssignments, percentage: calculatePct(schoolsWithAssignments), color: "bg-rose-500" },
    { module: "Expense Tracker", count: schoolsWithExpenses, percentage: calculatePct(schoolsWithExpenses), color: "bg-indigo-500" },
  ];

  // 3. Platform Monthly Transaction Volume (last 6 months)
  const payments = await prisma.paymentTransaction.findMany({
    where: { date: { gte: sixMonthsAgo }, status: "SUCCESS" },
    select: { amount: true, date: true },
  });

  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);
  const monthlyVolumeMap: Record<string, number> = {};
  payments.forEach((p) => {
    const key = monthKey(new Date(p.date));
    monthlyVolumeMap[key] = (monthlyVolumeMap[key] ?? 0) + Number(p.amount);
  });

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const label = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d);
    const key = monthKey(d);
    return {
      month: label,
      volume: monthlyVolumeMap[key] ?? 0,
    };
  });

  // 4. Plan breakdown
  const planDistribution = await prisma.school.groupBy({
    by: ["plan"],
    _count: { id: true },
  });

  const plans = planDistribution.map((p) => ({
    name: p.plan,
    count: p._count.id,
    percentage: totalSchools > 0 ? Math.round((p._count.id / totalSchools) * 100) : 0,
  }));

  return {
    totalSchools,
    totalStudents,
    totalTeachers,
    totalStaff,
    moduleAdoption,
    monthlyVolume: months,
    plans,
  };
}
