import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { ClassesContent } from "@/components/classes/classes-content";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) redirect("/dashboard");

  const [classes, teachers] = await Promise.all([
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
  ]);

  return <ClassesContent classes={classes} teachers={teachers} />;
}
