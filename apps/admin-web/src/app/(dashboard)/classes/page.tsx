import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { ClassesContent } from "@/components/classes/classes-content";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;
  const permissions = await getPermissions();
  if (!can(permissions, "classes")) redirect("/dashboard");

  const [classes, teachers, currentSession] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: schoolId },
      include: {
        classTeacher: { select: { id: true, name: true, email: true } },
        sections: { orderBy: { name: "asc" } },
        _count: {
          select: {
            students: { where: { isActive: true } },
          },
        },
      },
      orderBy: { grade: "asc" },
      take: 200,
    }),
    prisma.teacher.findMany({
      where: { schoolId: schoolId, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.academicSession.findFirst({
      where: { schoolId, isCurrent: true },
      select: { name: true },
    }),
  ]);

  return (
    <ClassesContent
      classes={classes}
      teachers={teachers}
      academicYear={currentSession?.name ?? null}
      canEdit={can(permissions, "classes", "manage")}
    />
  );
}
