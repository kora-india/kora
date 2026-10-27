import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { LedgerContent } from "@/components/ledger/ledger-content";
import { getCache } from "@/lib/redis";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";
import { getLedgerData } from "@/lib/reports/ledger";
import {
  ledgerQueryToSearch,
  parseLedgerQuery,
} from "@/lib/reports/ledger-query";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";

export const metadata = {
  title: "Transaction Ledger | SchoolOS",
  description:
    "Non-editable immutable source of truth for all school financial transactions, inflows, outflows, and advance settlements.",
};

export default async function LedgerPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  if (!can(await getPermissions(), "ledger")) redirect("/dashboard");

  // P2: filters come from the URL and are applied in SQL; the stat cards are
  // totals over every matching row, the table lists the newest `limit`.
  const query = parseLedgerQuery(
    props.searchParams ? await props.searchParams : {},
  );

  const [school, academicSessions, classes, feeComponents, expenseCategories] =
    await Promise.all([
      getCache(`cache:${schoolId}:school:ledgerHeader`, () =>
        prisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true, timezone: true },
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

  // Relative periods ("today") are keyed by the school's date, so a cached
  // view never outlives its day. Searches are not cached.
  const today = calendarDateInTimeZone(resolveTimeZone(school?.timezone));
  const load = () => getLedgerData(schoolId, query, classes, school?.timezone);
  const ledger = query.q
    ? await load()
    : await getCache(
        `cache:${schoolId}:ledger:view:${today}:${ledgerQueryToSearch(query) || "default"}`,
        load,
        600,
      );

  return (
    <LedgerContent
      school={JSON.parse(JSON.stringify(school))}
      query={query}
      metrics={ledger.metrics}
      totals={ledger.totals}
      transactions={JSON.parse(JSON.stringify(ledger.transactions))}
      advanceLedgers={JSON.parse(JSON.stringify(ledger.advances))}
      expenses={JSON.parse(JSON.stringify(ledger.expenses))}
      academicSessions={JSON.parse(JSON.stringify(academicSessions || []))}
      classes={JSON.parse(JSON.stringify(classes || []))}
      feeComponents={JSON.parse(JSON.stringify(feeComponents || []))}
      expenseCategories={JSON.parse(JSON.stringify(expenseCategories || []))}
      userRole={user.role}
    />
  );
}
