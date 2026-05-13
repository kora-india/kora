import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { TeachersContent } from "@/components/teachers/teachers-content";

export const metadata = { title: "Teachers" };

export default async function TeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) redirect("/dashboard");

  const [teachers, classes] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      include: {
        assignedClass: { select: { name: true } },
        assignedSection: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      include: { sections: { select: { id: true, name: true } } },
      orderBy: { grade: "asc" },
    }),
  ]);

  return <TeachersContent teachers={teachers} classes={classes} />;
}
