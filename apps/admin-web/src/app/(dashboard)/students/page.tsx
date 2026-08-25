import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { StudentsContent } from "@/components/students/students-content";

import { getCache } from "@/lib/redis";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role);

  const students = await getCache(`cache:${schoolId}:students:list`, () => 
    prisma.student.findMany({
      where: { schoolId: schoolId, isActive: true },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        feeCharges: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
        attendances: { select: { status: true, date: true }, orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    })
  );

  const classes = await getCache(`cache:${schoolId}:classes:list`, () => 
    prisma.class.findMany({
      where: { schoolId: schoolId },
      include: { sections: { select: { id: true, name: true } } },
      orderBy: { grade: "asc" },
      take: 200,
    })
  );

  return <StudentsContent students={students} classes={classes} canEdit={canEdit} />;
}
