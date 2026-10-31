import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getFeeHistorySetup } from "@/lib/actions/fee-history";
import { isAdmin } from "@/lib/session";
import { UserRole } from "@schoolos/types";
import { getCache } from "@/lib/redis";
import { todayInTimeZone } from "@/lib/fees/timezone";
import {
  monthlyCollections,
  monthlyExpenses,
  monthlyPendingDues,
  recentMonths,
} from "@/lib/reports/monthly-totals";

export const metadata = { title: "Dashboard" };

async function getDashboardData(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, plan: true, subscription: true, timezone: true },
  });
  // "Today" and the chart's months are the school's, not the server's.
  const today = todayInTimeZone(school?.timezone);
  const months = recentMonths(6, school?.timezone);

  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    pendingFeeAgg,
    presentAttendanceCount,
    totalAttendanceCount,
    recentActivity,
    notices,
    collectedByMonth,
    pendingByMonth,
    expenseByMonth,
    classesList,
  ] = await Promise.all([
    prisma.student.count({
      where: { schoolId, isActive: true },
    }),
    prisma.teacher.count({
      where: { schoolId, isActive: true },
    }),
    prisma.class.count({ where: { schoolId } }),
    prisma.feeChargeItem.aggregate({
      where: {
        charge: { schoolId, student: { isActive: true } },
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      _sum: {
        amount: true,
        paidAmount: true,
      },
    }),
    prisma.attendance.count({
      where: { schoolId, date: today, status: "PRESENT" },
    }),
    prisma.attendance.count({
      where: { schoolId, date: today },
    }),
    prisma.student.findMany({
      where: { schoolId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        feeCharges: {
          select: { status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.notice.findMany({
      where: { schoolId, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    // P1: six months of totals, summed in SQL
    monthlyCollections(schoolId, months, school?.timezone),
    monthlyPendingDues(schoolId, months),
    monthlyExpenses(schoolId, months, school?.timezone),
    prisma.class.findMany({
      where: { schoolId },
      take: 4,
      orderBy: { grade: "asc" },
      include: {
        _count: { select: { students: true } },
        attendances: {
          where: { date: today },
          select: { status: true },
        },
      },
    }),
  ]);

  const totalPendingFees =
    Number(pendingFeeAgg._sum.amount ?? 0) -
    Number(pendingFeeAgg._sum.paidAmount ?? 0);

  const todayAttendance = {
    present: presentAttendanceCount,
    total: totalAttendanceCount,
  };

  const revenueAreaData: { month: string; type: string; amount: number }[] = [];
  const revenueData = months.map(({ label, key }) => {
    const collected = collectedByMonth.get(key) ?? 0;
    const expenses = expenseByMonth.get(key) ?? 0;
    const pending = pendingByMonth.get(key) ?? 0;
    revenueAreaData.push({
      month: label,
      type: "Collected",
      amount: collected,
    });
    revenueAreaData.push({ month: label, type: "Expenses", amount: expenses });
    revenueAreaData.push({ month: label, type: "Pending", amount: pending });
    return {
      month: label,
      collected,
      pending,
      expenses,
    };
  });

  const attendancePercentage =
    todayAttendance.total > 0
      ? Math.round((todayAttendance.present / todayAttendance.total) * 100)
      : 0;

  const classAttendance = classesList.map((c) => {
    const totalStudents = c._count.students;
    const presentStudents = c.attendances.filter(
      (a) => a.status === "PRESENT",
    ).length;
    const pct =
      c.attendances.length > 0
        ? Math.round((presentStudents / c.attendances.length) * 100)
        : attendancePercentage;
    return {
      label: c.name,
      pct,
      students: totalStudents,
    };
  });

  const { evaluateSubscriptionValidity } = await import("@/lib/subscription");
  const subEval = school
    ? evaluateSubscriptionValidity(school.subscription || { plan: school.plan })
    : null;

  return {
    schoolName: school?.name ?? "School",
    schoolPlan: subEval?.plan ?? school?.plan ?? "FREE",
    isTrial: subEval?.isTrial ?? false,
    trialDaysRemaining: subEval?.daysRemaining ?? 0,
    stats: {
      totalStudents,
      totalTeachers,
      pendingFees: totalPendingFees,
      attendancePercentage,
      monthlyRevenue: revenueData[revenueData.length - 1]?.collected ?? 0,
      monthlyExpenses: revenueData[revenueData.length - 1]?.expenses ?? 0,
      activeClasses: totalClasses,
    },
    revenueData,
    revenueAreaData,
    classAttendance,
    recentStudents: recentActivity,
    notices,
  };
}

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function visibleDashboardData(
  data: DashboardData,
  { seeFees, seeExpenses }: { seeFees: boolean; seeExpenses: boolean },
): DashboardData {
  if (seeFees && seeExpenses) return data;
  return {
    ...data,
    stats: {
      ...data.stats,
      pendingFees: seeFees ? data.stats.pendingFees : 0,
      monthlyRevenue: seeFees ? data.stats.monthlyRevenue : 0,
      monthlyExpenses: seeExpenses ? data.stats.monthlyExpenses : 0,
    },
    revenueData: seeFees
      ? data.revenueData.map((r) => (seeExpenses ? r : { ...r, expenses: 0 }))
      : [],
    revenueAreaData: seeFees
      ? data.revenueAreaData.filter((d) => seeExpenses || d.type !== "Expenses")
      : [],
    recentStudents: seeFees
      ? data.recentStudents
      : data.recentStudents.map((s) => ({ ...s, feeCharges: [] })),
  };
}

import { SuperAdminDashboardContent } from "@/components/dashboard/super-admin-dashboard-content";
import { getSuperAdminDashboardData } from "@/lib/actions/super-admin";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;

  // Dedicated Super Admin Multi-Tenant Dashboard
  if (user.role === UserRole.SUPER_ADMIN) {
    const superAdminData = await getCache(
      "cache:superadmin:dashboard",
      () => getSuperAdminDashboardData(),
      120, // 2 minutes TTL
    );

    return (
      <SuperAdminDashboardContent data={superAdminData} userName={user.name} />
    );
  }

  const schoolId = user.schoolId;
  if (!schoolId) {
    return <div className="p-6 text-muted-foreground">No school assigned.</div>;
  }

  const data = await getCache(
    `cache:${schoolId}:dashboard`,
    () => getDashboardData(schoolId),
    300, // 5 minutes TTL
  );

  // The cached figures are the whole school's; leave out the money this
  // person may not see before anything reaches the browser.
  const permissions = await getPermissions();
  const access = {
    addStudents: can(permissions, "students", "manage"),
    seeFees: can(permissions, "fees"),
    collectFees: can(permissions, "fees", "manage"),
    seeExpenses: can(permissions, "expenses"),
    postNotices: can(permissions, "notices", "manage"),
  };

  // Onboarding's last step, until the school has students.
  const needsStudents = isAdmin(user.role) && data.stats.totalStudents === 0;
  const [setup, classes] = needsStudents
    ? await Promise.all([
        getFeeHistorySetup(),
        prisma.class.findMany({
          where: { schoolId },
          include: { sections: { select: { id: true, name: true } } },
          orderBy: { grade: "asc" },
          take: 200,
        }),
      ])
    : [null, []];

  return (
    <DashboardContent
      data={visibleDashboardData(data, access)}
      userRole={user.role}
      userName={user.name}
      access={access}
      addStudents={
        setup && !("error" in setup) ? { setup, classes } : undefined
      }
    />
  );
}
