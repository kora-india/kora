import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { FeeStructuresContent } from "@/components/settings/fee-structures-content";

export const metadata = { title: "Fee Structures" };

export default async function FeeStructuresPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role);

  const [structures, classes, feeTypes] = await Promise.all([
    prisma.feeStructure.findMany({
      where: { schoolId: user.schoolId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        classes: { select: { id: true, name: true }, orderBy: { grade: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true, feeStructureId: true },
      orderBy: { grade: "asc" },
    }),
    prisma.feeType.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <FeeStructuresContent
      structures={structures}
      classes={classes}
      feeTypeNames={feeTypes.map((f) => f.name)}
      canEdit={canEdit}
    />
  );
}
