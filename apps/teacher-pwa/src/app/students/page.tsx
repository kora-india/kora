import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) redirect("/login");

  const teacher = await prisma.teacher.findFirst({ where: { userId: user.id } });
  const students = teacher?.assignedClassId ? await prisma.student.findMany({
    where: { schoolId: user.schoolId, classId: teacher.assignedClassId, sectionId: teacher.assignedSectionId ?? undefined, isActive: true },
    include: { fees: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { rollNumber: "asc" },
  }) : [];

  return (
    <div className="min-h-screen bg-background pb-20 max-w-lg mx-auto">
      <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-sm font-bold">Students</h1>
          <p className="text-[10px] text-muted-foreground">{students.length} in your class</p>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {students.map((s: any) => {
          const feeStatus = s.fees?.[0]?.status ?? "PENDING";
          return (
            <div key={s.id} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 flex-shrink-0">
                {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">Roll #{s.rollNumber} · {s.parentPhone}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                feeStatus === "PAID" ? "bg-green-50 text-green-700 border-green-200" :
                feeStatus === "OVERDUE" ? "bg-red-50 text-red-700 border-red-200" :
                "bg-amber-50 text-amber-700 border-amber-200"
              }`}>{feeStatus}</span>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}
