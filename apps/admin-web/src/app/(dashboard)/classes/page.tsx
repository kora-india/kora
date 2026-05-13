import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { motion } from "framer-motion";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  const classes = user.schoolId ? await prisma.class.findMany({
    where: { schoolId: user.schoolId },
    include: { sections: true, _count: { select: { students: true } } },
    orderBy: { grade: "asc" },
  }) : [];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">Classes & Sections</h1>
        <p className="text-muted-foreground text-sm mt-1">{classes.length} classes configured</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {classes.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300 text-sm">
                {c.grade}
              </div>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{c.sections.length} sections</span>
            </div>
            <p className="text-sm font-semibold">{c.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c._count.students} students</p>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {c.sections.map((s: any) => (
                <span key={s.id} className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 px-2 py-0.5 rounded-full font-medium">
                  Section {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
