"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";

interface TeachersContentProps { teachers: any[] }

export function TeachersContent({ teachers }: TeachersContentProps) {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="text-muted-foreground text-sm mt-1">{teachers.length} teaching staff</p>
        </div>
        <button className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(teachers.length > 0 ? teachers : mockTeachers).map((t: any, i: number) => (
          <motion.div
            key={t.id ?? i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
            className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.subject}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground truncate">{t.email}</p>
              {(t.assignedClass?.name || t.assignedClassName) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800">
                  {t.assignedClass?.name ?? t.assignedClassName} · {t.assignedSection?.name ?? t.sectionName ?? "A"}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const mockTeachers = [
  { id: "1", name: "Priya Nair", email: "priya@dps.edu.in", subject: "Mathematics", assignedClass: { name: "Grade 8" }, assignedSection: { name: "A" } },
  { id: "2", name: "Rahul Verma", email: "rahul@dps.edu.in", subject: "Science", assignedClass: { name: "Grade 9" }, assignedSection: { name: "B" } },
  { id: "3", name: "Anita Roy", email: "anita@dps.edu.in", subject: "English", assignedClass: { name: "Grade 10" }, assignedSection: { name: "B" } },
  { id: "4", name: "Suresh Kumar", email: "suresh@dps.edu.in", subject: "History", assignedClass: { name: "Grade 7" }, assignedSection: { name: "A" } },
  { id: "5", name: "Meena Iyer", email: "meena@dps.edu.in", subject: "Geography", assignedClass: { name: "Grade 6" }, assignedSection: { name: "C" } },
];
