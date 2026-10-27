"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { UserRole } from "@schoolos/types";
import { getAllPlanLimitsMap } from "@/lib/plan-limits";
import { monthlyCollections, recentMonths } from "@/lib/reports/monthly-totals";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { PLAN_IDS, getPlan } from "@/lib/plans";

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

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // Run all platform queries and plan limit lookup in parallel
  const [
    totalSchools,
    activeSchools,
    totalStudents,
    totalTeachers,
    totalClasses,
    schoolsByPlan,
    paymentAgg,
    recentSchools,
    allSchools,
    pastSchools,
    planLimitsMap,
    plans,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { isActive: true } }),
    prisma.student.count({ where: { isActive: true } }),
    prisma.teacher.count({ where: { isActive: true } }),
    prisma.class.count(),
    prisma.school.groupBy({
      by: ["plan"],
      _count: { id: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.school.findMany({
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
    }),
    prisma.school.findMany({
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
    }),
    prisma.school.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, plan: true },
    }),
    getAllPlanLimitsMap(),
    getPlanCatalog(),
  ]);
  const priceOf = (plan: string) => getPlan(plans, plan).monthlyPriceInr;

  const suspendedSchools = totalSchools - activeSchools;

  // Plan Distribution & Estimated MRR
  const planCounts: Record<string, number> = {
    FREE: 0,
    BASIC: 0,
    PRO: 0,
    ENTERPRISE: 0,
  };

  let estimatedMRR = 0;
  for (const item of schoolsByPlan) {
    planCounts[item.plan] = item._count.id;
    estimatedMRR += item._count.id * priceOf(item.plan);
  }

  const planDistribution = PLAN_IDS.map((id) => ({
    name: plans[id].name,
    plan: id,
    count: planCounts[id],
    value: planCounts[id],
    price: plans[id].monthlyPriceInr,
  })).filter((p) => p.count > 0 || totalSchools === 0);

  // Platform Total Fee Volume Processed by Schools
  const totalFeeVolume = Number(paymentAgg._sum.amount ?? 0);
  const totalTransactionsCount = paymentAgg._count.id;

  // Check quota for each recent school using pre-fetched map
  const recentSchoolsWithQuota = recentSchools.map((school) => {
    const limits = planLimitsMap.get(school.plan) ?? {
      maxStudents: Infinity,
      maxTeachers: Infinity,
      maxClasses: Infinity,
      analyticsEnabled: false,
    };
    const studentCount = school._count.students;
    const maxStudents = limits.maxStudents;
    const usagePercent =
      maxStudents === Infinity
        ? 0
        : Math.min(100, Math.round((studentCount / maxStudents) * 100));
    return {
      id: school.id,
      name: school.name,
      subdomain: school.subdomain,
      email: school.email,
      phone: school.phone,
      plan: school.plan,
      planName: getPlan(plans, school.plan).name,
      isActive: school.isActive,
      createdAt: school.createdAt.toISOString(),
      studentCount,
      teacherCount: school._count.teachers,
      maxStudents,
      usagePercent,
    };
  });

  // Schools Near Limit (>80% Capacity) using pre-fetched map
  const schoolsNearLimit: {
    id: string;
    name: string;
    plan: string;
    planName: string;
    current: number;
    max: number;
    percent: number;
  }[] = [];
  for (const s of allSchools) {
    const limits = planLimitsMap.get(s.plan);
    if (limits && limits.maxStudents !== Infinity) {
      const pct = Math.round((s._count.students / limits.maxStudents) * 100);
      if (pct >= 80) {
        schoolsNearLimit.push({
          id: s.id,
          name: s.name,
          plan: s.plan,
          planName: getPlan(plans, s.plan).name,
          current: s._count.students,
          max: limits.maxStudents,
          percent: pct,
        });
      }
    }
  }

  // 7. Monthly School Onboarding (Last 6 Months)
  const monthKey = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
    }).format(d);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d),
      key: monthKey(d),
      count: 0,
      revenue: 0,
    };
  });

  pastSchools.forEach((s) => {
    const key = monthKey(new Date(s.createdAt));
    const m = months.find((entry) => entry.key === key);
    if (m) {
      m.count += 1;
      m.revenue += priceOf(s.plan);
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

  // P3: every count and the monthly volume run in parallel; the volume is
  // summed in SQL instead of loading six months of platform payments.
  const months = recentMonths(6, "Asia/Kolkata");
  const [
    totalSchools,
    totalStudents,
    totalTeachers,
    totalStaff,
    schoolsWithStudents,
    schoolsWithAttendance,
    schoolsWithFees,
    schoolsWithNotices,
    schoolsWithAssignments,
    schoolsWithExpenses,
    volumeByMonth,
    planDistribution,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.student.count({ where: { isActive: true } }),
    prisma.teacher.count({ where: { isActive: true } }),
    prisma.staff.count({ where: { isActive: true } }),
    prisma.school.count({ where: { students: { some: {} } } }),
    prisma.school.count({ where: { attendances: { some: {} } } }),
    prisma.school.count({ where: { feeCharges: { some: {} } } }),
    prisma.school.count({ where: { notices: { some: {} } } }),
    prisma.school.count({ where: { assignments: { some: {} } } }),
    prisma.school.count({ where: { expenses: { some: {} } } }),
    monthlyCollections(null, months, "Asia/Kolkata"),
    prisma.school.groupBy({ by: ["plan"], _count: { id: true } }),
  ]);
  const plans = await getPlanCatalog();

  const calculatePct = (count: number) =>
    totalSchools > 0 ? Math.round((count / totalSchools) * 100) : 0;

  const moduleAdoption = [
    {
      module: "Student Directory",
      count: schoolsWithStudents,
      percentage: calculatePct(schoolsWithStudents),
      color: "bg-blue-500",
    },
    {
      module: "Fee Management",
      count: schoolsWithFees,
      percentage: calculatePct(schoolsWithFees),
      color: "bg-violet-500",
    },
    {
      module: "Daily Attendance",
      count: schoolsWithAttendance,
      percentage: calculatePct(schoolsWithAttendance),
      color: "bg-emerald-500",
    },
    {
      module: "Notice Broadcasts",
      count: schoolsWithNotices,
      percentage: calculatePct(schoolsWithNotices),
      color: "bg-amber-500",
    },
    {
      module: "Homework & Assignments",
      count: schoolsWithAssignments,
      percentage: calculatePct(schoolsWithAssignments),
      color: "bg-rose-500",
    },
    {
      module: "Expense Tracker",
      count: schoolsWithExpenses,
      percentage: calculatePct(schoolsWithExpenses),
      color: "bg-indigo-500",
    },
  ];

  const monthlyVolume = months.map(({ key, label }) => ({
    month: label,
    volume: volumeByMonth.get(key) ?? 0,
  }));

  const planShares = planDistribution.map((p) => ({
    name: getPlan(plans, p.plan).name,
    count: p._count.id,
    percentage:
      totalSchools > 0 ? Math.round((p._count.id / totalSchools) * 100) : 0,
  }));

  return {
    totalSchools,
    totalStudents,
    totalTeachers,
    totalStaff,
    moduleAdoption,
    monthlyVolume,
    plans: planShares,
  };
}
