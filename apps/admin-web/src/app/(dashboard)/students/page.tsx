import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { StudentsContent } from "@/components/students/students-content";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const students = await prisma.student.findMany({
    where: { schoolId: user.schoolId, isActive: true },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      fees: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId },
    include: { sections: true },
    orderBy: { grade: "asc" },
  });

  return <StudentsContent students={students} classes={classes} />;
}
