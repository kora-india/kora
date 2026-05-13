import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AttendanceContent } from "@/components/attendance/attendance-content";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayRecords = await prisma.attendance.groupBy({
    by: ["classId", "status"],
    where: { schoolId: user.schoolId, date: today },
    _count: { id: true },
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId },
    include: { sections: true },
    orderBy: { grade: "asc" },
  });

  return <AttendanceContent classes={classes} todayRecords={todayRecords} />;
}
