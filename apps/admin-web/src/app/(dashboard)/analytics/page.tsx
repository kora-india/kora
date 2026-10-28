import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { AnalyticsContent } from "@/components/analytics/analytics-content";
import { getCache } from "@/lib/redis";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { cheapestPlanWith } from "@/lib/plans";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";
import { getAnalyticsData } from "@/lib/reports/analytics";

export const metadata = { title: "Analytics" };

import { SuperAdminAnalytics } from "@/components/analytics/super-admin-analytics";
import { getSuperAdminAnalyticsData } from "@/lib/actions/super-admin";
import { UserRole } from "@schoolos/types";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  // Super Admin Multi-Tenant Analytics
  if (user.role === UserRole.SUPER_ADMIN) {
    const superAdminAnalytics = await getCache(
      "cache:superadmin:analytics",
      () => getSuperAdminAnalyticsData(),
      120, // 2 minutes TTL
    );

    return <SuperAdminAnalytics {...superAdminAnalytics} />;
  }

  const schoolId = user.schoolId;
  if (!schoolId)
    return <div className="p-6 text-muted-foreground">No school assigned.</div>;
  // School analytics include revenue.
  if (!can(await getPermissions(), "analytics")) redirect("/dashboard");

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      timezone: true,
      subscription: { select: { plan: true, status: true } },
    },
  });

  const { hasFeatureAccess } = await import("@/lib/subscription");
  const plans = await getPlanCatalog();
  const canAccess = hasFeatureAccess(
    school?.plan || "FREE",
    school?.subscription?.status || "ACTIVE",
    "ANALYTICS",
    plans,
  );

  if (!canAccess) {
    const { PlanUpgradeGate } =
      await import("@/components/subscriptions/plan-upgrade-gate");
    return (
      <PlanUpgradeGate
        featureName="Advanced Analytics & Trends"
        description="Unlock comprehensive fee collections, attendance rate trends, cohort metrics, and cash flow projections."
        requiredPlan={cheapestPlanWith(plans, "ANALYTICS")}
        highlights={[
          "Real-time fee collection vs pending trends",
          "Student attendance rate and absence metrics",
          "Fee distribution across components",
          "Exportable analytical reports",
        ]}
      />
    );
  }

  const data = await getCache(
    `cache:${schoolId}:analytics`,
    () => getAnalyticsData(schoolId, school?.timezone),
    300, // 5 minutes TTL
  );

  return <AnalyticsContent {...data} />;
}
