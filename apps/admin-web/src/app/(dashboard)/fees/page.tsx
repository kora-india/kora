import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeesContent } from "@/components/fees/fees-content";

import { getCache } from "@/lib/redis";

export const metadata = { title: "Fees Management" };

export default async function FeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role);

  // Fetch V2 configuration data
  const academicSessions = await getCache(`cache:${user.schoolId}:academicSessions:list`, () => 
    prisma.academicSession.findMany({ where: { schoolId: user.schoolId }, orderBy: { startDate: 'desc' } })
  );
  
  const feeComponents = await getCache(`cache:${user.schoolId}:feeComponents:list`, () => 
    prisma.feeComponent.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: 'asc' } })
  );
  
  const feeStructures = await getCache(`cache:${user.schoolId}:feeStructures:list`, () => 
    prisma.feeStructure.findMany({ 
      where: { schoolId: user.schoolId },
      include: { items: { include: { component: true } } },
      orderBy: { createdAt: 'desc' }
    })
  );
  
  const classes = await getCache(`cache:${user.schoolId}:classes:list`, () => 
    prisma.class.findMany({ 
      where: { schoolId: user.schoolId },
      include: { classFeeStructures: true },
      orderBy: { grade: 'asc' }
    })
  );
  
  const students = await getCache(`cache:${user.schoolId}:students:feesList`, () => 
    prisma.student.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true, name: true, rollNumber: true, classId: true, advanceLedgers: true },
      orderBy: { name: 'asc' }
    })
  );
  
  const recentCharges = await getCache(`cache:${user.schoolId}:feeCharges:recent`, () => 
    prisma.feeCharge.findMany({
      where: { schoolId: user.schoolId },
      include: {
        student: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  );
  
  const transactions = await getCache(`cache:${user.schoolId}:transactions:recent`, () => 
    prisma.paymentTransaction.findMany({
      where: { schoolId: user.schoolId },
      include: {
        student: true,
        allocations: {
          include: {
            chargeItem: {
              include: { component: true, charge: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  );

  return (
    <FeesContent
      sessions={academicSessions}
      components={JSON.parse(JSON.stringify(feeComponents))}
      structures={JSON.parse(JSON.stringify(feeStructures))}
      classes={classes}
      students={JSON.parse(JSON.stringify(students))}
      recentCharges={JSON.parse(JSON.stringify(recentCharges))}
      transactions={JSON.parse(JSON.stringify(transactions))}
      canEdit={canEdit}
    />
  );
}
