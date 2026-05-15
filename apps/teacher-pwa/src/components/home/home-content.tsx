"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Calendar, Users, BookOpen, Bell, AlertCircle, CheckCircle } from "lucide-react";

interface HomeContentProps {
  user: { name: string; email: string };
  teacher: any;
  todayAttendanceDone: boolean;
  upcomingAssignments: number;
}

const timetable = [
  { time: "09:00 – 09:45", subject: "Algebra", isNow: true },
  { time: "11:00 – 11:45", subject: "Geometry", isNow: false },
  { time: "02:00 – 02:45", subject: "Statistics", isNow: false },
];

export function HomeContent({ user, teacher, todayAttendanceDone, upcomingAssignments }: HomeContentProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-5 pb-6 pt-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-xs font-medium">{greeting} 👋</p>
            <h1 className="text-white text-xl font-bold mt-0.5">{user.name}</h1>
            {teacher && (
              <div className="flex items-center gap-1.5 mt-2 bg-white/15 rounded-full px-3 py-1 w-fit">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-white text-xs font-medium">
                  {teacher.assignedClass?.name ?? "No class"} — Section {teacher.assignedSection?.name ?? "N/A"}
                </span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
            {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "My Class", value: teacher?.assignedClass?.name?.replace("Grade ", "Gr.") ?? "—" },
            { label: "Students", value: "42" },
            { label: "Attendance", value: todayAttendanceDone ? "✓ Done" : "Pending" },
          ].map((s) => (
            <div key={s.label} className="bg-white/15 rounded-xl p-2.5 text-center">
              <p className="text-white font-semibold text-sm">{s.value}</p>
              <p className="text-violet-200 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4 mt-4">
        {!todayAttendanceDone && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Attendance not submitted</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{teacher?.assignedClass?.name ?? "Your class"} · Today</p>
            </div>
            <Link href="/attendance/take" className="flex-shrink-0 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-amber-600 transition-colors active:scale-95">
              Take Now
            </Link>
          </motion.div>
        )}
        {todayAttendanceDone && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Attendance submitted ✓</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Marked for today — great work!</p>
            </div>
          </motion.div>
        )}

        <div>
          <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/attendance/take", label: "Take Attendance", sub: teacher?.assignedClass?.name ?? "My class", icon: Calendar, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
              { href: "/students", label: "My Students", sub: "42 students", icon: Users, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
              { href: "/assignments", label: "Assignments", sub: `${upcomingAssignments} upcoming`, icon: BookOpen, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
              { href: "/notices", label: "Notices", sub: "Post update", icon: Bell, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="bg-card border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md active:scale-[0.97] transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.color}`}>
                  <a.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Today&apos;s Timetable</h2>
          <div className="bg-card border rounded-2xl overflow-hidden divide-y">
            {timetable.map((t) => (
              <div key={t.time} className={`flex items-center gap-3 px-4 py-3.5 ${t.isNow ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}>
                <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${t.isNow ? "bg-violet-600" : "bg-muted"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.time}</p>
                </div>
                {t.isNow && <span className="text-[10px] bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-semibold">NOW</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
