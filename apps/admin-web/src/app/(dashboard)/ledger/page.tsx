import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { LedgerContent } from "@/components/ledger/ledger-content";
import { getCache } from "@/lib/redis";

export const metadata = {
  title: "Transaction Ledger | SchoolOS",
  description:
    "Non-editable immutable source of truth for all school financial transactions, inflows, outflows, and advance settlements.",
};

export default async function LedgerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const canView = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(
    user.role,
  );
  if (!canView) redirect("/dashboard");

  // Parallel data fetching with Redis cache fallback
  const [
    school,
    transactions,
    advanceLedgers,
    expenses,
    feeChargeItems,
    academicSessions,
    classes,
    feeComponents,
    expenseCategories,
  ] = await Promise.all([
    getCache(`cache:${schoolId}:school:details`, () =>
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      }),
    ),
    getCache(`cache:${schoolId}:ledger:transactions`, () =>
      prisma.paymentTransaction.findMany({
        where: { schoolId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              classId: true,
              class: { select: { id: true, name: true, grade: true } },
            },
          },
          allocations: {
            include: {
              chargeItem: {
                include: {
                  component: true,
                  charge: {
                    select: {
                      id: true,
                      title: true,
                      dueDate: true,
                      sessionId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
      }),
    ),
    getCache(`cache:${schoolId}:ledger:advances`, () =>
      prisma.advanceLedger.findMany({
        where: { student: { schoolId } },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              classId: true,
              class: { select: { id: true, name: true } },
            },
          },
          component: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
    getCache(`cache:${schoolId}:ledger:expenses`, () =>
      prisma.expense.findMany({
        where: { schoolId },
        include: {
          category: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      }),
    ),
    getCache(`cache:${schoolId}:ledger:feeChargeItems:v3`, () =>
      prisma.feeChargeItem.findMany({
        where: { charge: { schoolId } },
        select: {
          id: true,
          amount: true,
          paidAmount: true,
          status: true,
          component: { select: { id: true, name: true, category: true } },
          charge: {
            select: {
              id: true,
              title: true,
              dueDate: true,
              createdAt: true,
              sessionId: true,
              studentId: true,
              student: {
                select: {
                  id: true,
                  classId: true,
                },
              },
            },
          },
        },
      }),
    ),
    getCache(`cache:${schoolId}:academicSessions:list`, () =>
      prisma.academicSession.findMany({
        where: { schoolId },
        orderBy: { startDate: "desc" },
      }),
    ),
    getCache(`cache:${schoolId}:classes:list`, () =>
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, grade: true },
        orderBy: { grade: "asc" },
      }),
    ),
    getCache(`cache:${schoolId}:feeComponents:list`, () =>
      prisma.feeComponent.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
    ),
    getCache(`cache:${schoolId}:expenses:categories`, () =>
      prisma.expenseCategory.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
    ),
  ]);

  return (
    <LedgerContent
      school={JSON.parse(JSON.stringify(school))}
      transactions={JSON.parse(JSON.stringify(transactions || []))}
      advanceLedgers={JSON.parse(JSON.stringify(advanceLedgers || []))}
      expenses={JSON.parse(JSON.stringify(expenses || []))}
      feeChargeItems={JSON.parse(JSON.stringify(feeChargeItems || []))}
      academicSessions={JSON.parse(JSON.stringify(academicSessions || []))}
      classes={JSON.parse(JSON.stringify(classes || []))}
      feeComponents={JSON.parse(JSON.stringify(feeComponents || []))}
      expenseCategories={JSON.parse(JSON.stringify(expenseCategories || []))}
      userRole={user.role}
    />
  );
}
