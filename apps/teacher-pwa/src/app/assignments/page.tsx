import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  const teacher = await prisma.teacher.findFirst({ where: { userId: user.id } });
  const assignments = teacher ? await prisma.assignment.findMany({
    where: { schoolId: user.schoolId, teacherId: teacher.id },
    orderBy: { dueDate: "asc" },
  }) : [];

  return (
    <div className="min-h-screen bg-background pb-20 max-w-lg mx-auto">
      <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-bold">Assignments</h1>
          <p className="text-[10px] text-muted-foreground">{assignments.length} total</p>
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 bg-violet-600 text-white rounded-xl text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>
      <div className="p-4 space-y-3">
        {assignments.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No assignments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap + to create one</p>
          </div>
        ) : assignments.map((a: any) => (
          <div key={a.id} className="bg-card border rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold flex-1 mr-2">{a.title}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                new Date(a.dueDate) < new Date() ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
              }`}>
                {new Date(a.dueDate) < new Date() ? "Overdue" : "Due " + new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
            {a.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.description}</p>}
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
