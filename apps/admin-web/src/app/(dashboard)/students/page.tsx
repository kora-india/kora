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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const students = await getCache(`cache:${schoolId}:students:list`, () => 
    prisma.student.findMany({
      where: { schoolId: schoolId, isActive: true },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        feeCharges: {
          where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          select: {
            id: true,
            status: true,
            dueDate: true,
            title: true,
            items: { select: { amount: true, paidAmount: true, status: true } },
          },
        },
        attendances: {
          where: { date: today },
          select: { status: true, date: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    60
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
