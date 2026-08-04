import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeeTypesContent } from "@/components/settings/fee-types-content";

export const metadata = { title: "Fee Configuration" };

export default async function FeeTypesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role);

  const feeTypes = await prisma.feeType.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { name: "asc" },
  });

  return <FeeTypesContent feeTypes={feeTypes} canEdit={canEdit} />;
}
