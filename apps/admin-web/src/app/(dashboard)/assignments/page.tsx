import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AssignmentsContent } from "@/components/assignments/assignments-content";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  let classFilter: object = { schoolId: user.schoolId };

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId: user.schoolId },
      select: { assignedClassId: true },
    });
    if (teacher?.assignedClassId) {
      classFilter = { schoolId: user.schoolId, classId: teacher.assignedClassId };
    }
  }

  const [assignments, classes] = await Promise.all([
    prisma.assignment.findMany({
      where: classFilter,
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        teacher: { select: { name: true, userId: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      include: { sections: { select: { id: true, name: true } } },
      orderBy: { grade: "asc" },
    }),
  ]);

  return (
    <AssignmentsContent
      assignments={assignments}
      classes={classes}
      currentUserId={user.id}
      userRole={user.role}
    />
  );
}
