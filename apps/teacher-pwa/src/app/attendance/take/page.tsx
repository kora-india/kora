import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AttendanceTaker } from "@/components/attendance/attendance-taker";
import { BottomNav } from "@/components/layout/bottom-nav";

export const metadata = { title: "Take Attendance" };

export default async function TakeAttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  if (!user.schoolId) redirect("/login");

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id },
    include: {
      assignedClass: { select: { id: true, name: true } },
      assignedSection: { select: { id: true, name: true } },
    },
  });

  if (!teacher?.assignedClassId || !teacher?.assignedSectionId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pb-20">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">No class assigned. Contact admin.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const students = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      classId: teacher.assignedClassId,
      sectionId: teacher.assignedSectionId,
      isActive: true,
    },
    orderBy: { rollNumber: "asc" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findMany({
    where: {
      classId: teacher.assignedClassId,
      sectionId: teacher.assignedSectionId,
      date: today,
    },
    select: { studentId: true, status: true },
  });

  const existingMap: Record<string, string> = {};
  existing.forEach((r: { studentId: string; status: string }) => { existingMap[r.studentId] = r.status; });

  return (
    <div className="min-h-screen bg-background pb-20">
      <AttendanceTaker
        students={students}
        teacher={teacher}
        existingAttendance={existingMap}
        teacherId={user.id}
        schoolId={user.schoolId}
      />
      <BottomNav />
    </div>
  );
}
