import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { UserRole } from "@schoolos/types";
import { SubscriptionsContent } from "@/components/subscriptions/subscriptions-content";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { getPlan } from "@/lib/plans";

export const metadata = { title: "Subscriptions & Plans" };

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (user.role !== UserRole.SUPER_ADMIN) redirect("/dashboard");

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          students: { where: { isActive: true } },
          teachers: { where: { isActive: true } },
        },
      },
    },
  });

  const planCounts: Record<string, number> = {
    FREE: 0,
    BASIC: 0,
    PRO: 0,
    ENTERPRISE: 0,
  };

  const plans = await getPlanCatalog();
  const schoolsWithLimits = schools.map((school) => {
    planCounts[school.plan] = (planCounts[school.plan] ?? 0) + 1;
    const { limits } = getPlan(plans, school.plan);
    return {
      id: school.id,
      name: school.name,
      subdomain: school.subdomain,
      plan: school.plan,
      isActive: school.isActive,
      studentCount: school._count.students,
      maxStudents: limits.maxStudents,
      teacherCount: school._count.teachers,
      maxTeachers: limits.maxTeachers,
    };
  });

  return (
    <SubscriptionsContent
      plans={plans}
      schools={schoolsWithLimits}
      planCounts={planCounts}
    />
  );
}
