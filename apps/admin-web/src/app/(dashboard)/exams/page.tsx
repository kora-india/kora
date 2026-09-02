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
