import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { getTransportData } from "@/lib/actions/transport";
import { TransportContent } from "@/components/transport/transport-content";
import { hasFeatureAccess } from "@/lib/subscription";
import { PlanUpgradeGate } from "@/components/subscriptions/plan-upgrade-gate";

export const metadata = {
  title: "Transport & Fleet Management | Kora",
  description:
    "Manage school bus routes, fleet vehicles, drivers, and transport fee allocations.",
};

export default async function TransportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) redirect("/login");

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      subscription: { select: { plan: true, status: true } },
    },
  });

  const canAccess = hasFeatureAccess(
    school?.plan || "FREE",
    school?.subscription?.status || "ACTIVE",
    "TRANSPORT",
  );

  if (!canAccess && user.role !== "SUPER_ADMIN") {
    return (
      <PlanUpgradeGate
        featureName="Transport & Fleet Management"
        description="Track bus routes, fleet vehicles, driver records, and automated transport fee billing."
        requiredPlan="BASIC"
        highlights={[
          "Vehicle and bus route tracking",
          "Driver and conductor directory",
          "Pickup and drop point stop allocation",
          "Automated monthly transport fee billing integration",
        ]}
      />
    );
  }

  const data = await getTransportData();

  if ("error" in data) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <h3 className="font-bold">Failed to load transport data</h3>
          <p className="text-sm mt-1">{data.error}</p>
        </div>
      </div>
    );
  }

  if (!data.metrics) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <h3 className="font-bold">Failed to load transport data</h3>
          <p className="text-sm mt-1">
            Please check school session configuration.
          </p>
        </div>
      </div>
    );
  }

  return <TransportContent initialData={data as any} />;
}
