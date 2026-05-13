import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeesContent } from "@/components/fees/fees-content";
import { UserRole } from "@schoolos/types";

export const metadata = { title: "Fees" };

export default async function FeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = [UserRole.SCHOOL_ADMIN, UserRole.ACCOUNTANT].includes(user.role);

  const fees = await prisma.fee.findMany({
    where: { schoolId: user.schoolId },
    include: {
      student: { select: { name: true, rollNumber: true } },
      class: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
  });

  const summary = await prisma.fee.groupBy({
    by: ["status"],
    where: { schoolId: user.schoolId },
    _sum: { amount: true },
    _count: { id: true },
  });

  return <FeesContent fees={fees} summary={summary} canEdit={canEdit} />;
}
