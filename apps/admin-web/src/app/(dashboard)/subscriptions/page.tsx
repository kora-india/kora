import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { UserRole } from "@schoolos/types";
import { SubscriptionsContent } from "@/components/subscriptions/subscriptions-content";
import { getPlanLimits } from "@/lib/plan-limits";

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

  const schoolsWithLimits = await Promise.all(
    schools.map(async (school) => {
      planCounts[school.plan] = (planCounts[school.plan] ?? 0) + 1;
      const limits = await getPlanLimits(school.plan);
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
    })
  );

  return <SubscriptionsContent schools={schoolsWithLimits} planCounts={planCounts} />;
}
