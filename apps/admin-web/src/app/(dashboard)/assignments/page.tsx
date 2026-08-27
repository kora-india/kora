import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AssignmentsContent } from "@/components/assignments/assignments-content";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  let classFilter: object = { schoolId: schoolId };

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId: schoolId },
      include: {
        assignedSections: true,
        classTeacherOf: { select: { id: true } },
      },
    });
    if (teacher) {
      const secClassIds = teacher.assignedSections.map((as) => as.classId);
      const ctClassIds = teacher.classTeacherOf.map((ct) => ct.id);
      const legacyClassId = teacher.assignedClassId ? [teacher.assignedClassId] : [];
      const assignedClassIds = Array.from(new Set([...secClassIds, ...ctClassIds, ...legacyClassId]));
      if (assignedClassIds.length > 0) {
        classFilter = { schoolId: schoolId, classId: { in: assignedClassIds } };
      }
    }
  }

  const assignments = await prisma.assignment.findMany({
    where: classFilter,
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      teacher: { select: { name: true, userId: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 300,
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: schoolId },
    include: { sections: { select: { id: true, name: true } } },
    orderBy: { grade: "asc" },
    take: 200,
  });

  return (
    <AssignmentsContent
      assignments={assignments}
      classes={classes}
      currentUserId={user.id}
      userRole={user.role}
    />
  );
}
