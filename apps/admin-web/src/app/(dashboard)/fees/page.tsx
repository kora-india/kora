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

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(
    user.role,
  );

  // Fetch configuration data and recent transactions in parallel with selected lightweight fields
  const [
    school,
    academicSessions,
    feeComponents,
    feeStructures,
    classes,
    students,
    recentCharges,
    transactions,
  ] = await Promise.all([
    getCache(`cache:${schoolId}:school:full`, () =>
      prisma.school.findUnique({ where: { id: schoolId } }),
    ),
    getCache(`cache:${schoolId}:academicSessions:list`, () =>
      prisma.academicSession.findMany({
        where: { schoolId },
        orderBy: { startDate: "desc" },
      }),
    ),
    getCache(`cache:${schoolId}:feeComponents:list`, () =>
      prisma.feeComponent.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
    ),
    getCache(`cache:${schoolId}:feeStructures:list`, () =>
      prisma.feeStructure.findMany({
        where: { schoolId },
        include: { items: { include: { component: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ),
    getCache(`cache:${schoolId}:classes:withFeeStructures`, () =>
      prisma.class.findMany({
        where: { schoolId },
        include: {
          sections: { select: { id: true, name: true } },
          classFeeStructures: true,
        },
        orderBy: { grade: "asc" },
      }),
    ),
    // Select only lightweight list fields for student dropdown; full details load dynamically on demand
    getCache(`cache:${schoolId}:students:feesList:compact`, () =>
      prisma.student.findMany({
        where: { schoolId, isActive: true },
        select: {
          id: true,
          name: true,
          rollNumber: true,
          classId: true,
        },
        orderBy: { name: "asc" },
      }),
    ),
    // Select only needed fields for recent charges list
    getCache(`cache:${schoolId}:feeCharges:recent:compact`, () =>
      prisma.feeCharge.findMany({
        where: { schoolId },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          studentId: true,
          student: {
            select: { id: true, name: true, rollNumber: true, classId: true },
          },
          items: {
            select: {
              id: true,
              amount: true,
              paidAmount: true,
              status: true,
              componentId: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
    // Select only needed fields for recent transactions list
    getCache(`cache:${schoolId}:transactions:recent:compact`, () =>
      prisma.paymentTransaction.findMany({
        where: { schoolId },
        select: {
          id: true,
          amount: true,
          method: true,
          reference: true,
          receiptNo: true,
          createdAt: true,
          studentId: true,
          student: {
            select: { id: true, name: true, rollNumber: true },
          },
          allocations: {
            select: {
              id: true,
              amount: true,
              chargeItem: {
                select: {
                  id: true,
                  component: { select: { id: true, name: true } },
                  charge: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
  ]);

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
