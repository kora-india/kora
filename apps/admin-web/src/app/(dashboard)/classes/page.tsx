import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { ClassesContent } from "@/components/classes/classes-content";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) redirect("/dashboard");

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId },
    include: {
      sections: { orderBy: { name: "asc" } },
      _count: { select: { students: true } },
    },
    orderBy: { grade: "asc" },
    take: 200,
  });

  return <ClassesContent classes={classes} />;
}
