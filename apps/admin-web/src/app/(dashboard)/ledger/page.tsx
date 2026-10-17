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

export default async function LedgerPage(props: {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    limit?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const canView = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(
    user.role,
  );
  if (!canView) redirect("/dashboard");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const fromDate = searchParams.from ? new Date(searchParams.from) : null;
  const toDate = searchParams.to ? new Date(searchParams.to) : null;
  const limit = Math.min(
    Math.max(parseInt(searchParams.limit || "200", 10), 20),
    500,
  );

  // Default active window: 12 months for bounded caching and fast rendering
  const defaultCutoff = new Date();
  defaultCutoff.setFullYear(defaultCutoff.getFullYear() - 1);
  defaultCutoff.setHours(0, 0, 0, 0);

  const dateFilter =
    fromDate && toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())
      ? { gte: fromDate, lte: toDate }
      : { gte: defaultCutoff };

  const cacheKeySuffix =
    fromDate && toDate
      ? `${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}`
      : "recent";

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
    getCache(`cache:${schoolId}:school:name`, () =>
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      }),
    ),
    getCache(
      `cache:${schoolId}:ledger:transactions:${cacheKeySuffix}:${limit}`,
      () =>
        prisma.paymentTransaction.findMany({
          where: { schoolId, date: dateFilter },
          take: limit,
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
    getCache(
      `cache:${schoolId}:ledger:advances:${cacheKeySuffix}:${limit}`,
      () =>
        prisma.advanceLedger.findMany({
          where: {
            student: { schoolId },
            createdAt: dateFilter,
          },
          take: limit,
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
    getCache(
      `cache:${schoolId}:ledger:expenses:${cacheKeySuffix}:${limit}`,
      () =>
        prisma.expense.findMany({
          where: { schoolId, date: dateFilter },
          take: limit,
          include: {
            category: true,
            recordedBy: { select: { name: true } },
          },
          orderBy: { date: "desc" },
        }),
    ),
    getCache(`cache:${schoolId}:ledger:feeChargeItems:active`, () =>
      prisma.feeChargeItem.findMany({
        where: {
          charge: { schoolId },
          OR: [
            { charge: { dueDate: dateFilter } },
            { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          ],
        },
        take: 1000,
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
    getCache(`cache:${schoolId}:classes:basic`, () =>
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
