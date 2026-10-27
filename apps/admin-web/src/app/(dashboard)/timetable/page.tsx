import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { TimetableContent } from "@/components/timetable/timetable-content";
import { getTimetable, getTimetablePeriods } from "@/lib/actions/timetable";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { cheapestPlanWith } from "@/lib/plans";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";

export const metadata = { title: "Timetable & Scheduling | Kora" };

export default async function TimetablePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) {
    return <div className="p-6">No school assigned.</div>;
  }
  const permissions = await getPermissions();
  if (!can(permissions, "timetable")) redirect("/dashboard");

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      name: true,
      plan: true,
      subscription: { select: { plan: true, status: true } },
    },
  });

  const { hasFeatureAccess } = await import("@/lib/subscription");
  const plans = await getPlanCatalog();
  const canAccess = hasFeatureAccess(
    school?.plan || "FREE",
    school?.subscription?.status || "ACTIVE",
    "TIMETABLE",
    plans,
  );

  if (!canAccess && user.role !== "SUPER_ADMIN") {
    const { PlanUpgradeGate } =
      await import("@/components/subscriptions/plan-upgrade-gate");
    return (
      <PlanUpgradeGate
        featureName="Automated Timetable & Scheduling"
        description="Automated constraint-satisfaction scheduling of classes, teacher assignments, and real-time conflict detection."
        requiredPlan={cheapestPlanWith(plans, "TIMETABLE")}
        highlights={[
          "AI constraint solver allocating complete week in seconds",
          "Strict teacher double-booking and room overlap prevention",
          "Dual perspective grid for classes and individual teachers",
          "Custom bell schedule and recess configuration",
        ]}
      />
    );
  }

  const [classes, teachers, periods] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      include: {
        sections: { orderBy: { name: "asc" } },
      },
      orderBy: { grade: "asc" },
    }),
    prisma.teacher.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: "asc" },
    }),
    getTimetablePeriods(),
  ]);

  const initialSectionId = classes[0]?.sections?.[0]?.id;
  const initialSlots = initialSectionId
    ? await getTimetable({ sectionId: initialSectionId })
    : [];

  return (
    <TimetableContent
      schoolName={school?.name}
      initialClasses={classes}
      initialTeachers={teachers}
      initialPeriods={periods as any}
      initialSlots={initialSlots}
      userRole={user.role}
      canEdit={can(permissions, "timetable", "manage")}
    />
  );
}
