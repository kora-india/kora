import { prisma } from "@schoolos/db";
import { resolveTimeZone } from "@/lib/fees/timezone";
import {
  collectionsByMethod,
  monthlyCollections,
  monthlyPendingDues,
  recentMonths,
} from "./monthly-totals";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/**
 * The school analytics page's figures. Money uses the same sums as the
 * dashboard and ledger (monthly-totals.ts): months are calendar months in the
 * school's time zone, collections exclude advance settlements, and waived fee
 * items are neither billed nor owed.
 */
export async function getAnalyticsData(
  schoolId: string,
  timeZone?: string | null,
) {
  const tz = resolveTimeZone(timeZone);
  const months = recentMonths(6, tz);
  const windowStart = new Date(`${months[0].key}-01T00:00:00Z`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    collectedByMonth,
    pendingByMonth,
    paymentMethods,
    feeItems,
    attendanceRows,
    activeStudentCount,
    newStudentCount,
  ] = await Promise.all([
    monthlyCollections(schoolId, months, tz),
    monthlyPendingDues(schoolId, months),
    collectionsByMethod(schoolId, months, tz),
    // Fee items due in the window, of current students, not waived.
    prisma.feeChargeItem.findMany({
      where: {
        status: { not: "WAIVED" },
        charge: {
          schoolId,
          dueDate: { gte: windowStart },
          student: { isActive: true },
        },
      },
      select: {
        amount: true,
        paidAmount: true,
        status: true,
        component: { select: { name: true } },
      },
    }),
    // Attendance for the last 30 days.
    prisma.attendance.findMany({
      where: { schoolId, date: { gte: thirtyDaysAgo } },
      select: { date: true, status: true },
      orderBy: { date: "asc" },
    }),
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.student.count({
      where: { schoolId, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  let totalBilledFee = 0;
  let totalCollectedFee = 0;
  let paidItemCount = 0;
  const componentSums = new Map<string, number>();
  for (const item of feeItems) {
    const amount = Number(item.amount || 0);
    const paid = Number(item.paidAmount || 0);
    totalBilledFee = roundMoney(totalBilledFee + amount);
    totalCollectedFee = roundMoney(totalCollectedFee + paid);
    if (item.status === "PAID" || (amount > 0 && paid >= amount)) {
      paidItemCount++;
    }
    const name = item.component?.name || "Tuition Fee";
    componentSums.set(
      name,
      roundMoney((componentSums.get(name) ?? 0) + amount),
    );
  }

  const revenueAreaData: { month: string; type: string; amount: number }[] = [];
  const revenueData = months.map(({ key, label }) => {
    const collected = collectedByMonth.get(key) ?? 0;
    const pending = pendingByMonth.get(key) ?? 0;
    revenueAreaData.push({
      month: label,
      type: "Collected",
      amount: collected,
    });
    revenueAreaData.push({ month: label, type: "Pending", amount: pending });
    return { month: label, collected, pending };
  });

  // Attendance rate by month, over the last 30 days of records.
  const attendanceMonthKey = (d: Date) => d.toISOString().slice(0, 7);
  const presentByMonth: Record<string, number> = {};
  const totalAttendanceByMonth: Record<string, number> = {};
  for (const a of attendanceRows) {
    const key = attendanceMonthKey(new Date(a.date));
    totalAttendanceByMonth[key] = (totalAttendanceByMonth[key] ?? 0) + 1;
    if (a.status === "PRESENT") {
      presentByMonth[key] = (presentByMonth[key] ?? 0) + 1;
    }
  }
  const attendanceData = months.map(({ key, label }) => ({
    month: label,
    rate:
      totalAttendanceByMonth[key] > 0
        ? Math.round(
            ((presentByMonth[key] ?? 0) / totalAttendanceByMonth[key]) * 100,
          )
        : 0,
    totalRecords: totalAttendanceByMonth[key] ?? 0,
  }));

  const sortedComponents = [...componentSums.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const totalComponents = sortedComponents.reduce((s, c) => s + c.value, 0);
  const feeDistribution = sortedComponents.map((c) => ({
    ...c,
    percentage:
      totalComponents > 0 ? Math.round((c.value / totalComponents) * 100) : 0,
  }));

  const daysSeen = new Set(
    attendanceRows.map((a) => new Date(a.date).toDateString()),
  );
  const presentLast30 = attendanceRows.filter(
    (a) => a.status === "PRESENT",
  ).length;
  const avgAttendanceRate =
    attendanceRows.length > 0
      ? Math.round((presentLast30 / attendanceRows.length) * 100)
      : 0;
  const avgPresentPerDay =
    daysSeen.size > 0 ? Math.round(presentLast30 / daysSeen.size) : 0;

  const thisMonthRevenue =
    collectedByMonth.get(months[months.length - 1].key) ?? 0;
  const lastMonthRevenue =
    collectedByMonth.get(months[months.length - 2]?.key) ?? 0;
  const revenueChangePct =
    lastMonthRevenue > 0
      ? Math.round(
          ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000,
        ) / 10
      : null;

  return {
    revenueData,
    revenueAreaData,
    attendanceData,
    feeDistribution,
    paymentMethods,
    metrics: {
      totalRevenue: thisMonthRevenue,
      /** What was paid towards the window's fee items (not all collections). */
      allTimeRevenue: totalCollectedFee,
      revenueChangePct,
      feeCollectionRate:
        totalBilledFee > 0
          ? Math.round((totalCollectedFee / totalBilledFee) * 1000) / 10
          : 0,
      paidFeeCount: paidItemCount,
      totalFeeCount: feeItems.length,
      avgAttendanceRate,
      avgPresentPerDay,
      newEnrolments: newStudentCount,
      activeStudentCount,
    },
  };
}
