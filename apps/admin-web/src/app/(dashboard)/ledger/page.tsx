import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { LedgerContent } from "@/components/ledger/ledger-content";
import { ActivityContent } from "@/components/ledger/activity-content";
import { getCache } from "@/lib/redis";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";
import { getLedgerData } from "@/lib/reports/ledger";
import {
  ledgerQueryToSearch,
  parseLedgerQuery,
} from "@/lib/reports/ledger-query";
import { getActivityLog, getActivityPeople } from "@/lib/reports/activity";
import { parseActivityQuery } from "@/lib/reports/activity-query";
import { calendarDateInTimeZone, resolveTimeZone } from "@/lib/fees/timezone";

export const metadata = {
  title: "Ledger | SchoolOS",
  description:
    "Every fee collection and expense, who recorded it, and (for admins) everything people do in the app.",
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

  const params = props.searchParams ? await props.searchParams : {};
  // The activity log shows everyone's sign-ins and changes: admins only.
  const isAdmin = user.role === "SCHOOL_ADMIN" || user.role === "SUPER_ADMIN";
  if (params.tab === "activity" && !isAdmin) redirect("/ledger");

  const school = await getCache(`cache:${schoolId}:school:ledgerHeader`, () =>
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, timezone: true },
    }),
  );
  const timeZone = resolveTimeZone(school?.timezone);

  if (params.tab === "activity") {
    const query = parseActivityQuery(params);
    const [log, people] = await Promise.all([
      getActivityLog(schoolId, query, timeZone),
      getActivityPeople(schoolId),
    ]);
    return (
      <ActivityContent
        query={query}
        rows={log.rows}
        total={log.total}
        people={people}
        timeZone={timeZone}
      />
    );
  }

  // Filters come from the URL and are applied in SQL; the totals cover every
  // matching row, the list one page of them.
  const query = parseLedgerQuery(params);

  const [academicSessions, classes, feeComponents, expenseCategories] =
    await Promise.all([
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
  const today = calendarDateInTimeZone(timeZone);
  const load = () => getLedgerData(schoolId, query, timeZone);
  const ledger = query.q
    ? await load()
    : await getCache(
        `cache:${schoolId}:ledger:page:${today}:${ledgerQueryToSearch(query) || "default"}`,
        load,
        600,
      );

  return (
    <LedgerContent
      schoolName={school?.name ?? "School"}
      query={query}
      metrics={ledger.metrics}
      rows={ledger.rows}
      total={ledger.total}
      timeZone={timeZone}
      showActivityTab={isAdmin}
      sessions={academicSessions.map((s) => ({ id: s.id, name: s.name }))}
      classes={classes}
      feeComponents={feeComponents.map((c) => ({ id: c.id, name: c.name }))}
      expenseCategories={expenseCategories.map((c) => ({
        id: c.id,
        name: c.name,
      }))}
    />
  );
}
