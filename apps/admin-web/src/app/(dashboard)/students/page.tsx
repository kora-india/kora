import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { StudentsContent } from "@/components/students/students-content";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role);

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        feeCharges: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      include: { sections: { select: { id: true, name: true } } },
      orderBy: { grade: "asc" },
      take: 200,
    }),
  ]);

  return <StudentsContent students={students} classes={classes} canEdit={canEdit} />;
}
