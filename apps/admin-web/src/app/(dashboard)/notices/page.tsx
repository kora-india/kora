import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { NoticesContent } from "@/components/notices/notices-content";

export const metadata = { title: "Notices" };

const PAGE_SIZE = 20;

export default async function NoticesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string }>;
}>) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [notices, totalNotices, classes] = await Promise.all([
    prisma.notice.findMany({
      where: { schoolId: user.schoolId },
      include: { publishedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notice.count({ where: { schoolId: user.schoolId } }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true },
      orderBy: { grade: "asc" },
      take: 200,
    }),
  ]);

  return (
    <NoticesContent
      notices={notices}
      classes={classes}
      currentUserId={user.id}
      userRole={user.role}
      page={page}
      totalPages={Math.max(1, Math.ceil(totalNotices / PAGE_SIZE))}
      totalCount={totalNotices}
    />
  );
}
