import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AnalyticsContent } from "@/components/analytics/analytics-content";

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

  const payments = await prisma.payment.findMany({
    where: { schoolId, paidAt: { gte: sixMonthsAgo } },
    select: { amount: true, paidAt: true },
  });

  const pendingFeeRows = await prisma.fee.findMany({
    where: { schoolId, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { gte: sixMonthsAgo } },
    select: { amount: true, dueDate: true },
  });

  const attendanceRows = await prisma.attendance.findMany({
    where: { schoolId, date: { gte: sixMonthsAgo } },
    select: { date: true, status: true },
  });

  const feeTypeSums = await prisma.fee.groupBy({
    by: ["feeType"],
    where: { schoolId },
    _sum: { amount: true },
  });

  const totalFeeCount = await prisma.fee.count({ where: { schoolId } });
  const paidFeeCount = await prisma.fee.count({ where: { schoolId, status: "PAID" } });
  const activeStudentCount = await prisma.student.count({ where: { schoolId, isActive: true } });
  const newStudentCount = await prisma.student.count({ where: { schoolId, createdAt: { gte: startOfMonth } } });

  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d), key: monthKey(d) };
  });

  // Fee collection trend
  const collectedByMonth: Record<string, number> = {};
  payments.forEach((p: (typeof payments)[number]) => {
    const key = monthKey(p.paidAt);
    collectedByMonth[key] = (collectedByMonth[key] ?? 0) + Number(p.amount);
  });
  const pendingByMonth: Record<string, number> = {};
  pendingFeeRows.forEach((f: (typeof pendingFeeRows)[number]) => {
    const key = monthKey(f.dueDate);
    pendingByMonth[key] = (pendingByMonth[key] ?? 0) + Number(f.amount);
  });
  const revenueData = months.map(({ label, key }) => ({
    month: label,
    collected: collectedByMonth[key] ?? 0,
    pending: pendingByMonth[key] ?? 0,
  }));

  // Attendance rate trend
  const presentByMonth: Record<string, number> = {};
  const totalByMonth: Record<string, number> = {};
  attendanceRows.forEach((a: (typeof attendanceRows)[number]) => {
    const key = monthKey(a.date);
    totalByMonth[key] = (totalByMonth[key] ?? 0) + 1;
    if (a.status === "PRESENT") presentByMonth[key] = (presentByMonth[key] ?? 0) + 1;
  });
  const attendanceData = months.map(({ label, key }) => ({
    month: label,
    rate: totalByMonth[key] > 0 ? Math.round(((presentByMonth[key] ?? 0) / totalByMonth[key]) * 100) : 0,
  }));

  // Fee distribution by type (top N + Other)
  const sortedFeeTypes = feeTypeSums
    .map((f: (typeof feeTypeSums)[number]) => ({ name: f.feeType, amount: Number(f._sum.amount ?? 0) }))
    .filter((f: { name: string; amount: number }) => f.amount > 0)
    .sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount);
  const totalFeeAmount = sortedFeeTypes.reduce((sum: number, f: { amount: number }) => sum + f.amount, 0);
  const topFeeTypes = sortedFeeTypes.slice(0, FEE_TYPE_SLICE_LIMIT);
  const otherAmount = sortedFeeTypes.slice(FEE_TYPE_SLICE_LIMIT).reduce((sum: number, f: { amount: number }) => sum + f.amount, 0);
  const feeDistribution = [
    ...topFeeTypes.map((f: { name: string; amount: number }) => ({
      name: f.name,
      value: totalFeeAmount > 0 ? Math.round((f.amount / totalFeeAmount) * 100) : 0,
    })),
    ...(otherAmount > 0 ? [{ name: "Other", value: totalFeeAmount > 0 ? Math.round((otherAmount / totalFeeAmount) * 100) : 0 }] : []),
  ];

  // Attendance last 30 days (avg present/day)
  const last30 = attendanceRows.filter((a: (typeof attendanceRows)[number]) => a.date >= thirtyDaysAgo);
  const daysSeen = new Set(last30.map((a: (typeof attendanceRows)[number]) => a.date.toDateString()));
  const presentLast30 = last30.filter((a: (typeof attendanceRows)[number]) => a.status === "PRESENT").length;
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

  const feeCollectionRate = totalFeeCount > 0 ? Math.round((paidFeeCount / totalFeeCount) * 1000) / 10 : 0;

  return {
    revenueData,
    attendanceData,
    feeDistribution,
    metrics: {
      totalRevenue: thisMonthRevenue,
      revenueChangePct,
      feeCollectionRate,
      paidFeeCount,
      totalFeeCount,
      avgAttendanceRate,
      avgPresentPerDay,
      newEnrolments: newStudentCount,
      activeStudentCount,
    },
  };
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6 text-muted-foreground">No school assigned.</div>;

  const data = await getAnalyticsData(user.schoolId);

  return <AnalyticsContent {...data} />;
}
