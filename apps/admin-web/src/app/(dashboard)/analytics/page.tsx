import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AnalyticsContent } from "@/components/analytics/analytics-content";
import { getCache } from "@/lib/redis";

export const metadata = { title: "Analytics" };

const FEE_TYPE_SLICE_LIMIT = 5;

async function getAnalyticsData(schoolId: string) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // 1. Real Payment Transactions
  const paymentTxs = await prisma.paymentTransaction.findMany({
    where: { schoolId, status: "SUCCESS" },
    select: { amount: true, date: true, method: true },
    orderBy: { date: "asc" },
  });

  // 2. Real Fee Charges & Items
  const feeCharges = await prisma.feeCharge.findMany({
    where: { schoolId },
    include: {
      items: {
        include: {
          component: { select: { name: true, category: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // 3. Real Attendance
  const attendanceRows = await prisma.attendance.findMany({
    where: { schoolId },
    select: { date: true, status: true },
    orderBy: { date: "asc" },
  });

  // 4. Student Counts
  const activeStudentCount = await prisma.student.count({ where: { schoolId, isActive: true } });
  const newStudentCount = await prisma.student.count({ where: { schoolId, createdAt: { gte: thirtyDaysAgo } } });

  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d), key: monthKey(d) };
  });

  // Collected amounts by month (from PaymentTransaction)
  const collectedByMonth: Record<string, number> = {};
  const methodMap: Record<string, number> = {};

  paymentTxs.forEach((tx) => {
    const key = monthKey(new Date(tx.date));
    const amt = Number(tx.amount || 0);
    collectedByMonth[key] = (collectedByMonth[key] ?? 0) + amt;
    methodMap[tx.method] = (methodMap[tx.method] ?? 0) + amt;
  });

  // Pending and Billed amounts by month (from FeeCharges)
  const pendingByMonth: Record<string, number> = {};
  const componentSums: Record<string, number> = {};
  let totalBilledFee = 0;
  let totalCollectedFee = 0;
  let paidItemCount = 0;
  let totalItemCount = 0;

  feeCharges.forEach((charge) => {
    const key = monthKey(new Date(charge.dueDate));
    charge.items.forEach((item) => {
      totalItemCount++;
      const amt = Number(item.amount || 0);
      const paid = Number(item.paidAmount || 0);
      const due = item.status === "WAIVED" ? 0 : Math.max(0, amt - paid);

      totalBilledFee += amt;
      totalCollectedFee += paid;

      if (item.status === "PAID" || (amt > 0 && paid >= amt)) {
        paidItemCount++;
      }

      if (due > 0) {
        pendingByMonth[key] = (pendingByMonth[key] ?? 0) + due;
      }

      const compName = item.component?.name || "Tuition Fee";
      componentSums[compName] = (componentSums[compName] ?? 0) + amt;
    });
  });

  // Format Fee Collection Area Chart Data
  const revenueAreaData: { month: string; type: string; amount: number }[] = [];
  const revenueData = months.map(({ label, key }) => {
    const collected = collectedByMonth[key] ?? 0;
    const pending = pendingByMonth[key] ?? 0;
    revenueAreaData.push({ month: label, type: "Collected", amount: collected });
    revenueAreaData.push({ month: label, type: "Pending", amount: pending });
    return {
      month: label,
      collected,
      pending,
    };
  });

  // Attendance rate trend
  const presentByMonth: Record<string, number> = {};
  const totalAttendanceByMonth: Record<string, number> = {};

  attendanceRows.forEach((a) => {
    const key = monthKey(new Date(a.date));
    totalAttendanceByMonth[key] = (totalAttendanceByMonth[key] ?? 0) + 1;
    if (a.status === "PRESENT") presentByMonth[key] = (presentByMonth[key] ?? 0) + 1;
  });

  const attendanceData = months.map(({ label, key }) => ({
    month: label,
    rate: totalAttendanceByMonth[key] > 0 ? Math.round(((presentByMonth[key] ?? 0) / totalAttendanceByMonth[key]) * 100) : 0,
    totalRecords: totalAttendanceByMonth[key] ?? 0,
  }));

  // Fee Distribution by Component
  const sortedCompList = Object.entries(componentSums)
    .map(([name, amount]) => ({ name, value: amount }))
    .sort((a, b) => b.value - a.value);

  const totalCompSum = sortedCompList.reduce((sum, c) => sum + c.value, 0);
  const feeDistribution = sortedCompList.map((c) => ({
    name: c.name,
    value: c.value,
    percentage: totalCompSum > 0 ? Math.round((c.value / totalCompSum) * 100) : 0,
  }));

  // Attendance in last 30 days
  const last30 = attendanceRows.filter((a) => new Date(a.date) >= thirtyDaysAgo);
  const daysSeen = new Set(last30.map((a) => new Date(a.date).toDateString()));
  const presentLast30 = last30.filter((a) => a.status === "PRESENT").length;
  const avgAttendanceRate = last30.length > 0 ? Math.round((presentLast30 / last30.length) * 100) : 0;
  const avgPresentPerDay = daysSeen.size > 0 ? Math.round(presentLast30 / daysSeen.size) : 0;

  // Revenue this month vs last month
  const thisMonthKey = months[months.length - 1].key;
  const lastMonthKey = months[months.length - 2]?.key;
  const thisMonthRevenue = collectedByMonth[thisMonthKey] ?? 0;
  const lastMonthRevenue = lastMonthKey ? collectedByMonth[lastMonthKey] ?? 0 : 0;
  const revenueChangePct = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
    : null;

  // Overall collection rate
  const feeCollectionRate = totalBilledFee > 0 ? Math.round((totalCollectedFee / totalBilledFee) * 1000) / 10 : 0;

  // Payment Methods
  const paymentMethods = Object.entries(methodMap).map(([method, amount]) => ({
    method,
    amount,
  }));

  return {
    revenueData,
    revenueAreaData,
    attendanceData,
    feeDistribution,
    paymentMethods,
    metrics: {
      totalRevenue: thisMonthRevenue || totalCollectedFee,
      revenueChangePct,
      feeCollectionRate,
      paidFeeCount: paidItemCount,
      totalFeeCount: totalItemCount,
      avgAttendanceRate,
      avgPresentPerDay,
      newEnrolments: newStudentCount,
      activeStudentCount,
    },
  };
}

import { SuperAdminAnalytics } from "@/components/analytics/super-admin-analytics";
import { getSuperAdminAnalyticsData } from "@/lib/actions/super-admin";
import { UserRole } from "@schoolos/types";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  // Super Admin Multi-Tenant Analytics
  if (user.role === UserRole.SUPER_ADMIN) {
    const superAdminAnalytics = await getCache(
      "cache:superadmin:analytics",
      () => getSuperAdminAnalyticsData(),
      120 // 2 minutes TTL
    );

    return <SuperAdminAnalytics {...superAdminAnalytics} />;
  }

  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6 text-muted-foreground">No school assigned.</div>;

  const data = await getCache(
    `cache:${schoolId}:analytics`,
    () => getAnalyticsData(schoolId),
    300 // 5 minutes TTL
  );

  return <AnalyticsContent {...data} />;
}

