import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardTour } from "@/components/layout/dashboard-tour";
import { UserRole } from "@schoolos/types";

export const metadata = { title: "Dashboard" };

async function getDashboardData(schoolId: string) {
  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    pendingFees,
    todayAttendance,
    recentActivity,
    notices,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.teacher.count({ where: { schoolId, isActive: true } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.fee.aggregate({
      where: { schoolId, status: { in: ["PENDING", "OVERDUE"] } },
      _sum: { amount: true },
    }),
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [present, total] = await Promise.all([
        prisma.attendance.count({ where: { schoolId, date: today, status: "PRESENT" } }),
        prisma.attendance.count({ where: { schoolId, date: today } }),
      ]);
      return { present, total };
    })(),
    prisma.student.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        fees: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.notice.findMany({
      where: { schoolId, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  // Revenue by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [payments, pendingFeeRows] = await Promise.all([
    prisma.payment.findMany({
      where: { schoolId, paidAt: { gte: sixMonthsAgo } },
      select: { amount: true, paidAt: true },
    }),
    prisma.fee.findMany({
      where: { schoolId, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { gte: sixMonthsAgo } },
      select: { amount: true, dueDate: true },
    }),
  ]);

  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);

  const revenueByMonth: Record<string, number> = {};
  payments.forEach((p: (typeof payments)[number]) => {
    const key = monthKey(p.paidAt);
    revenueByMonth[key] = (revenueByMonth[key] ?? 0) + Number(p.amount);
  });

  const pendingByMonth: Record<string, number> = {};
  pendingFeeRows.forEach((f: (typeof pendingFeeRows)[number]) => {
    const key = monthKey(f.dueDate);
    pendingByMonth[key] = (pendingByMonth[key] ?? 0) + Number(f.amount);
  });

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d), key: monthKey(d) };
  });

  const revenueData = months.map(({ label, key }) => ({
    month: label,
    collected: revenueByMonth[key] ?? 0,
    pending: pendingByMonth[key] ?? 0,
  }));

  return {
    stats: {
      totalStudents,
      totalTeachers,
      pendingFees: Number(pendingFees._sum.amount ?? 0),
      attendancePercentage: todayAttendance.total > 0
        ? Math.round((todayAttendance.present / todayAttendance.total) * 100)
        : 0,
      monthlyRevenue: revenueData[revenueData.length - 1]?.collected ?? 0,
      activeClasses: totalClasses,
    },
    revenueData,
    recentStudents: recentActivity,
    notices,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const schoolId = user.schoolId;

  if (!schoolId && user.role !== UserRole.SUPER_ADMIN) {
    return <div className="p-6 text-muted-foreground">No school assigned.</div>;
  }

  const data = schoolId ? await getDashboardData(schoolId) : null;

  return (
    <>
      <DashboardTour />
      <DashboardContent data={data} userRole={user.role} userName={user.name} />
    </>
  );
}
