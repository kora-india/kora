import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeesContent } from "@/components/fees/fees-content";

export const metadata = { title: "Fees Management" };

export default async function FeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role);

  // Fetch V2 configuration data
  const [
    academicSessions,
    feeComponents,
    feeStructures,
    classes,
    students,
    recentCharges
  ] = await Promise.all([
    prisma.academicSession.findMany({ where: { schoolId: user.schoolId }, orderBy: { startDate: 'desc' } }),
    prisma.feeComponent.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: 'asc' } }),
    prisma.feeStructure.findMany({ 
      where: { schoolId: user.schoolId },
      include: { items: { include: { component: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.class.findMany({ 
      where: { schoolId: user.schoolId },
      include: { classFeeStructures: true },
      orderBy: { grade: 'asc' }
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true, name: true, rollNumber: true, classId: true, advanceLedgers: true },
      orderBy: { name: 'asc' }
    }),
    prisma.feeCharge.findMany({
      where: { schoolId: user.schoolId },
      include: {
        student: true,
        items: true,
        allocations: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  ]);

  return (
    <FeesContent
      sessions={academicSessions}
      components={feeComponents}
      structures={feeStructures}
      classes={classes}
      students={students}
      recentCharges={recentCharges}
      canEdit={canEdit}
    />
  );
}
