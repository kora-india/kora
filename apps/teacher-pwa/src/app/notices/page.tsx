import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NoticesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  const notices = user.schoolId ? await prisma.notice.findMany({
    where: { schoolId: user.schoolId, isPublished: true },
    include: { publishedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  }) : [];

  const PRIORITY_DOT: Record<string, string> = { HIGH: "bg-red-500", MEDIUM: "bg-amber-500", LOW: "bg-green-500" };

  return (
    <div className="min-h-screen bg-background pb-20 max-w-lg mx-auto">
      <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-sm font-bold">Notices</h1>
          <p className="text-[10px] text-muted-foreground">{notices.length} notices</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {notices.map((n) => (
          <div key={n.id} className="bg-card border rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[n.priority] ?? "bg-muted"}`} />
              <div>
                <h3 className="text-sm font-semibold">{n.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{n.content}</p>
                <p className="text-[10px] text-muted-foreground mt-2">By {n.publishedBy.name} · {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
              </div>
            </div>
          </div>
        ))}
        {notices.length === 0 && <div className="text-center py-16 text-sm text-muted-foreground">No notices yet</div>}
      </div>
      <BottomNav />
    </div>
  );
}
