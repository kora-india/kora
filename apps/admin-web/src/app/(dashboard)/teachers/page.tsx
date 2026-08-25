import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { TeachersContent } from "@/components/teachers/teachers-content";

export const metadata = { title: "Teachers & Staff" };

export default async function TeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) redirect("/dashboard");

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: schoolId, isActive: true },
    include: {
      assignedClass: { select: { name: true } },
      assignedSection: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const staffList = (prisma as any).staff
    ? await prisma.staff.findMany({
        where: { schoolId: schoolId, isActive: true },
        orderBy: { name: "asc" },
        take: 500,
      })
    : [];

  const classes = await prisma.class.findMany({
    where: { schoolId: schoolId },
    include: { sections: { select: { id: true, name: true } } },
    orderBy: { grade: "asc" },
    take: 200,
  });

  return <TeachersContent teachers={teachers} staffList={staffList} classes={classes} />;
}
