import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { SchoolsContent } from "@/components/schools/schools-content";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { PLAN_IDS } from "@/lib/plans";

export const metadata = { title: "Schools" };

export default async function SchoolsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const schools = await prisma.school.findMany({
    include: {
      _count: {
        select: { students: true, teachers: true, users: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const plans = await getPlanCatalog();
  const planNames = Object.fromEntries(
    PLAN_IDS.map((id) => [id, plans[id].name]),
  );

  return <SchoolsContent schools={schools} planNames={planNames} />;
}
