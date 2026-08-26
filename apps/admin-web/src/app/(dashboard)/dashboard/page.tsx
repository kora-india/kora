import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardTour } from "@/components/layout/dashboard-tour";
import { UserRole } from "@schoolos/types";
import { getCache } from "@/lib/redis";

export const metadata = { title: "Dashboard" };

async function getDashboardData(schoolId: string) {
  const totalStudents = await prisma.student.count({ where: { schoolId, isActive: true } });
  const totalTeachers = await prisma.teacher.count({ where: { schoolId, isActive: true } });
  const totalClasses = await prisma.class.count({ where: { schoolId } });
  const pendingFeeItems = await prisma.feeChargeItem.findMany({
    where: { charge: { schoolId }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    select: { amount: true, paidAmount: true },
  });
  const totalPendingFees = pendingFeeItems.reduce((acc, item) => acc + (Number(item.amount) - Number(item.paidAmount)), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const present = await prisma.attendance.count({ where: { schoolId, date: today, status: "PRESENT" } });
  const total = await prisma.attendance.count({ where: { schoolId, date: today } });
  const todayAttendance = { present, total };

  const recentActivity = await prisma.student.findMany({
    where: { schoolId, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      feeCharges: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const notices = await prisma.notice.findMany({
    where: { schoolId, isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  // Revenue by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const payments = await prisma.paymentTransaction.findMany({
    where: { schoolId, date: { gte: sixMonthsAgo }, status: "SUCCESS" },
    select: { amount: true, date: true },
  });

  const pendingFeeRows = await prisma.feeChargeItem.findMany({
    where: { charge: { schoolId, dueDate: { gte: sixMonthsAgo } }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    select: { amount: true, paidAmount: true, charge: { select: { dueDate: true } } },
  });

  const expensesList = await prisma.expense.findMany({
    where: { schoolId, date: { gte: sixMonthsAgo } },
    select: { amount: true, date: true },
  });

  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);

  const revenueByMonth: Record<string, number> = {};
  payments.forEach((p: (typeof payments)[number]) => {
    const key = monthKey(new Date(p.date));
    revenueByMonth[key] = (revenueByMonth[key] ?? 0) + Number(p.amount);
  });

  const pendingByMonth: Record<string, number> = {};
  pendingFeeRows.forEach((f: (typeof pendingFeeRows)[number]) => {
    const key = monthKey(new Date(f.charge.dueDate));
    pendingByMonth[key] = (pendingByMonth[key] ?? 0) + (Number(f.amount) - Number(f.paidAmount));
  });

  const expenseByMonth: Record<string, number> = {};
  expensesList.forEach((e: (typeof expensesList)[number]) => {
    const key = monthKey(new Date(e.date));
    expenseByMonth[key] = (expenseByMonth[key] ?? 0) + Number(e.amount);
  });

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d), key: monthKey(d) };
  });

  const revenueAreaData: { month: string; type: string; amount: number }[] = [];
  const revenueData = months.map(({ label, key }) => {
    const collected = revenueByMonth[key] ?? 0;
    const expenses = expenseByMonth[key] ?? 0;
    const pending = pendingByMonth[key] ?? 0;
    revenueAreaData.push({ month: label, type: "Collected", amount: collected });
    revenueAreaData.push({ month: label, type: "Expenses", amount: expenses });
    revenueAreaData.push({ month: label, type: "Pending", amount: pending });
    return {
      month: label,
      collected,
      pending,
      expenses,
    };
  });

  // Class-wise attendance
  const classesList = await prisma.class.findMany({
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
  });

  const attendancePercentage = todayAttendance.total > 0
    ? Math.round((todayAttendance.present / todayAttendance.total) * 100)
    : 0;

  const classAttendance = classesList.map((c) => {
    const totalStudents = c._count.students;
    const presentStudents = c.attendances.filter((a) => a.status === "PRESENT").length;
    const pct = c.attendances.length > 0
      ? Math.round((presentStudents / c.attendances.length) * 100)
      : attendancePercentage;
    return {
      label: c.name,
      pct,
      students: totalStudents,
    };
  });

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });

  return {
    schoolName: school?.name ?? "School",
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
      120 // 2 minutes TTL
    );

    return <SuperAdminDashboardContent data={superAdminData} userName={user.name} />;
  }

  const schoolId = user.schoolId;
  if (!schoolId) {
    return <div className="p-6 text-muted-foreground">No school assigned.</div>;
  }

  const data = await getCache(
    `cache:${schoolId}:dashboard`,
    () => getDashboardData(schoolId),
    300 // 5 minutes TTL
  );

  return (
    <>
      <DashboardTour />
      <DashboardContent data={data} userRole={user.role} userName={user.name} />
    </>
  );
}

