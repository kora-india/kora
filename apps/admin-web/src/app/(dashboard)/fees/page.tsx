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
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role);

  // Fetch V2 configuration data
  const school = await getCache(`cache:${schoolId}:school:details`, () => 
    prisma.school.findUnique({ where: { id: schoolId } })
  );

  const academicSessions = await getCache(`cache:${schoolId}:academicSessions:list`, () => 
    prisma.academicSession.findMany({ where: { schoolId: schoolId }, orderBy: { startDate: 'desc' } })
  );
  
  const feeComponents = await getCache(`cache:${schoolId}:feeComponents:list`, () => 
    prisma.feeComponent.findMany({ where: { schoolId: schoolId }, orderBy: { name: 'asc' } })
  );
  
  const feeStructures = await getCache(`cache:${schoolId}:feeStructures:list`, () => 
    prisma.feeStructure.findMany({ 
      where: { schoolId: schoolId },
      include: { items: { include: { component: true } } },
      orderBy: { createdAt: 'desc' }
    })
  );
  
  const classes = await getCache(`cache:${schoolId}:classes:list`, () => 
    prisma.class.findMany({ 
      where: { schoolId: schoolId },
      include: { 
        sections: { select: { id: true, name: true } },
        classFeeStructures: true 
      },
      orderBy: { grade: 'asc' }
    })
  );
  
  const students = await getCache(`cache:${schoolId}:students:feesList`, () => 
    prisma.student.findMany({
      where: { schoolId: schoolId, isActive: true },
      select: { id: true, name: true, rollNumber: true, classId: true, advanceLedgers: true },
      orderBy: { name: 'asc' }
    })
  );
  
  const recentCharges = await getCache(`cache:${schoolId}:feeCharges:recent`, () => 
    prisma.feeCharge.findMany({
      where: { schoolId: schoolId },
      include: {
        student: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  );
  
  const transactions = await getCache(`cache:${schoolId}:transactions:recent`, () => 
    prisma.paymentTransaction.findMany({
      where: { schoolId: schoolId },
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
      school={JSON.parse(JSON.stringify(school))}
      canEdit={canEdit}
    />
  );
}
