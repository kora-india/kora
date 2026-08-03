import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) redirect("/login");

  const teacher = await prisma.teacher.findFirst({ where: { userId: user.id } });

  const records = teacher ? await prisma.attendance.groupBy({
    by: ["date", "status"],
    where: { schoolId: user.schoolId, classId: teacher.assignedClassId ?? undefined },
    _count: { id: true },
    orderBy: { date: "desc" },
  }).then((rows: any[]) => {
    const byDate: Record<string, { present: number; absent: number }> = {};
    rows.forEach((r: any) => {
      const d = new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      if (!byDate[d]) byDate[d] = { present: 0, absent: 0 };
      if (r.status === "PRESENT") byDate[d].present += r._count.id;
      else byDate[d].absent += r._count.id;
    });
    return Object.entries(byDate).slice(0, 10).map(([date, counts]) => ({
      date,
      ...counts,
      pct: Math.round((counts.present / (counts.present + counts.absent)) * 100),
    }));
  }) : [];

  return (
    <div className="min-h-screen bg-background pb-20 max-w-lg mx-auto">
      <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-bold">Attendance</h1>
          <p className="text-[10px] text-muted-foreground">History & Records</p>
        </div>
        <Link href="/attendance/take" className="flex items-center gap-1.5 h-8 px-3 bg-violet-600 text-white rounded-xl text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Take
        </Link>
      </div>
      <div className="p-4 space-y-3">
        {records.map((r: any) => (
          <div key={r.date} className="bg-card border rounded-2xl p-4 flex items-center gap-4">
            <div className="text-center w-12">
              <p className="text-lg font-bold">{r.pct}%</p>
              <p className="text-[10px] text-muted-foreground">{r.date}</p>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${r.pct}%` }} />
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px] text-green-600">{r.present} present</span>
                <span className="text-[10px] text-red-600">{r.absent} absent</span>
              </div>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No attendance records yet</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
