import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { NoticesContent } from "@/components/notices/notices-content";

export const metadata = { title: "Notices" };

export default async function NoticesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const [notices, classes] = await Promise.all([
    prisma.notice.findMany({
      where: { schoolId: user.schoolId },
      include: { publishedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true },
      orderBy: { grade: "asc" },
    }),
  ]);

  return (
    <NoticesContent
      notices={notices}
      classes={classes}
      currentUserId={user.id}
      userRole={user.role}
    />
  );
}
