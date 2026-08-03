import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { HomeContent } from "@/components/home/home-content";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;

  let teacher = null;
  let todayAttendanceDone = false;
  let upcomingAssignments = 0;

  if (user.schoolId) {
    teacher = await prisma.teacher.findFirst({
      where: { userId: user.id },
      include: {
        assignedClass: { select: { name: true } },
        assignedSection: { select: { name: true } },
      },
    });

    if (teacher?.assignedClassId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attCount = await prisma.attendance.count({
        where: {
          schoolId: user.schoolId,
          classId: teacher.assignedClassId,
          date: today,
          markedById: user.id,
        },
      });
      todayAttendanceDone = attCount > 0;

      upcomingAssignments = await prisma.assignment.count({
        where: {
          schoolId: user.schoolId,
          classId: teacher.assignedClassId,
          dueDate: { gte: new Date() },
        },
      });
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HomeContent
        user={{ name: user.name, email: user.email }}
        teacher={teacher}
        todayAttendanceDone={todayAttendanceDone}
        upcomingAssignments={upcomingAssignments}
      />
      <BottomNav />
    </div>
  );
}
