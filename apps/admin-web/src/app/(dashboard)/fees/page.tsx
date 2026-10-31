import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeesContent } from "@/components/fees/fees-content";

import { getCache } from "@/lib/redis";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/session";

export const metadata = { title: "Fees Management" };

export default async function FeesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The old Logs & Activities tab moved to the ledger.
  if ((await props.searchParams)?.tab === "logs") redirect("/ledger");

  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const permissions = await getPermissions();
  if (!can(permissions, "fees")) redirect("/dashboard");
  const canEdit = can(permissions, "fees", "manage");

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
    advanceBalances,
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
    // The five latest payments, for Recent Payments on the collection tab;
    // the full list is on the ledger.
    getCache(`cache:${schoolId}:transactions:recent:latest`, () =>
      prisma.paymentTransaction.findMany({
        where: { schoolId },
        select: {
          id: true,
          amount: true,
          method: true,
          reference: true,
          receiptNo: true,
          status: true,
          date: true,
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
                  // Item and charge status drive the "partial" badge; the
                  // category drives "Late fine included".
                  status: true,
                  component: {
                    select: { id: true, name: true, category: true },
                  },
                  charge: { select: { id: true, title: true, status: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ),
    // Each student's advance balance, summed in SQL (the overrides table
    // shows it) instead of shipping every advance row.
    getCache(`cache:${schoolId}:students:advanceBalances`, () =>
      prisma.advanceLedger.groupBy({
        by: ["studentId"],
        where: { student: { schoolId, isActive: true } },
        _sum: { amount: true },
      }),
    ),
  ]);

  const advanceByStudent = new Map(
    advanceBalances.map((a) => [a.studentId, Number(a._sum.amount ?? 0)]),
  );
  const studentsWithAdvance = students.map((s) => ({
    ...s,
    advanceBalance: advanceByStudent.get(s.id) ?? 0,
  }));

  return (
    <FeesContent
      sessions={academicSessions}
      components={JSON.parse(JSON.stringify(feeComponents))}
      structures={JSON.parse(JSON.stringify(feeStructures))}
      classes={classes}
      students={JSON.parse(JSON.stringify(studentsWithAdvance))}
      recentCharges={JSON.parse(JSON.stringify(recentCharges))}
      transactions={JSON.parse(JSON.stringify(transactions))}
      school={JSON.parse(JSON.stringify(school))}
      canEdit={canEdit}
      canImportBalances={isAdmin(user.role)}
    />
  );
}
