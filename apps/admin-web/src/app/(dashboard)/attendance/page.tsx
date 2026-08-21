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
      userRole={user.role}
      userId={user.id}
      assignedClassId={assignedClassId}
      assignedSectionId={assignedSectionId}
    />
  );
}
