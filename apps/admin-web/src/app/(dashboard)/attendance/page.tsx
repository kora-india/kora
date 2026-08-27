import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AttendanceContent } from "@/components/attendance/attendance-content";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let assignedClassId: string | null = null;
  let assignedSectionId: string | null = null;

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId: schoolId },
      select: { assignedClassId: true, assignedSectionId: true },
    });
    assignedClassId = teacher?.assignedClassId ?? null;
    assignedSectionId = teacher?.assignedSectionId ?? null;
  }

  const todayRecords = await prisma.attendance.groupBy({
    by: ["classId", "status"],
    where: { schoolId: schoolId, date: today },
    _count: { id: true },
  });

  // Calculate Monday of the current week
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  saturday.setHours(23, 59, 59, 999);

  const weekAttendances = await prisma.attendance.findMany({
    where: {
      schoolId: schoolId,
      date: {
        gte: monday,
        lte: saturday,
      },
    },
    select: {
      date: true,
      status: true,
    },
  });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyAttendance = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toDateString();
    const dayRecords = weekAttendances.filter((a) => new Date(a.date).toDateString() === dateStr);
    const present = dayRecords.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const absent = dayRecords.filter((a) => a.status === "ABSENT").length;
    return {
      day: dayNames[i],
      present,
      absent,
      total: dayRecords.length,
    };
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: schoolId },
    include: { sections: { orderBy: { name: "asc" } } },
    orderBy: { grade: "asc" },
    take: 200,
  });

  return (
    <AttendanceContent
      classes={classes}
      todayRecords={todayRecords}
      weeklyAttendance={weeklyAttendance}
      userRole={user.role}
      userId={user.id}
      assignedClassId={assignedClassId}
      assignedSectionId={assignedSectionId}
    />
  );
}
