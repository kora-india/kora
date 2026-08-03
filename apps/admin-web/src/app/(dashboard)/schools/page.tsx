import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { SchoolsContent } from "@/components/schools/schools-content";

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

  return <SchoolsContent schools={schools} />;
}
