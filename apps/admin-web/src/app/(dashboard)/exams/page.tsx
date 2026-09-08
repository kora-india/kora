import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { ExamsContent } from "@/components/exams/exams-content";
import { getExams } from "@/lib/actions/exams";

export const metadata = { title: "Examinations & Report Cards | SchoolOS" };

export default async function ExamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      subscription: { select: { plan: true, status: true } },
    },
  });

  const { hasFeatureAccess } = await import("@/lib/subscription");
  const canAccess = hasFeatureAccess(
    school?.plan || "FREE",
    school?.subscription?.status || "ACTIVE",
    "EXAMS",
  );

  if (!canAccess && user.role !== "SUPER_ADMIN") {
    const { PlanUpgradeGate } =
      await import("@/components/subscriptions/plan-upgrade-gate");
    return (
      <PlanUpgradeGate
        featureName="Examinations & Institutional Report Cards"
        description="Manage academic terms, batch marks entry, CBSE 9-point grading, and printable institutional report cards."
        requiredPlan="PRO"
        highlights={[
          "CBSE 9-point and percentage grading schemes",
          "Batch marks entry across classes and sections",
          "Printable student report cards with performance radar",
          "Class-wide result analytics and subject averages",
        ]}
      />
    );
  }

  const [exams, classes] = await Promise.all([
    getExams(),
    prisma.class.findMany({
      where: { schoolId },
      include: {
        sections: { orderBy: { name: "asc" } },
      },
      orderBy: { grade: "asc" },
    }),
  ]);

  return <ExamsContent exams={exams} classes={classes} userRole={user.role} />;
}
