import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeesContent } from "@/components/fees/fees-content";

export const metadata = { title: "Fees" };

export default async function FeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role);

  const [fees, summary, students, classes, feeTypes] = await Promise.all([
    prisma.fee.findMany({
      where: { schoolId: user.schoolId },
      include: {
        student: { select: { name: true, rollNumber: true } },
        class: { select: { name: true } },
      },
      orderBy: { dueDate: "desc" },
      take: 100,
    }),
    prisma.fee.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true, name: true, classId: true, rollNumber: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true },
      orderBy: { grade: "asc" },
      take: 200,
    }),
    prisma.feeType.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <FeesContent
      fees={fees}
      summary={summary}
      students={students}
      classes={classes}
      feeTypes={feeTypes.map((f) => f.name)}
      canEdit={canEdit}
    />
  );
}
