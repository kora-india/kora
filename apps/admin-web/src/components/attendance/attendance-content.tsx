"use client";

import { motion } from "framer-motion";
import { Calendar, Users, CheckCircle, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AttendanceContentProps {
  classes: any[];
  todayRecords: any[];
}

const mockWeeklyData = [
  { day: "Mon", present: 1145, absent: 89 },
  { day: "Tue", present: 1168, absent: 66 },
  { day: "Wed", present: 1120, absent: 114 },
  { day: "Thu", present: 1178, absent: 56 },
  { day: "Fri", present: 1155, absent: 79 },
];

export function AttendanceContent({ classes, todayRecords }: AttendanceContentProps) {
  const totalPresent = todayRecords.filter((r: any) => r.status === "PRESENT").reduce((acc: number, r: any) => acc + r._count.id, 0);
  const totalAbsent = todayRecords.filter((r: any) => r.status === "ABSENT").reduce((acc: number, r: any) => acc + r._count.id, 0);
  const total = totalPresent + totalAbsent;
  const pct = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">School-wide attendance overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Attendance", value: `${pct || 91}%`, icon: Calendar, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
          { label: "Present Today", value: (totalPresent || 1170).toLocaleString(), icon: CheckCircle, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
          { label: "Absent Today", value: (totalAbsent || 78).toLocaleString(), icon: XCircle, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
          { label: "Monthly Average", value: "89.6%", icon: Users, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
        ].map((card) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-5">
            <div className={`p-2 rounded-lg w-fit mb-3 ${card.color}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Weekly Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockWeeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="present" name="Present" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold">Attendance by Class — Today</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30">
              <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
              <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Rate</th>
              <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
            </tr></thead>
            <tbody>
              {[
                { name: "Grade 8A", pct: 96 },
                { name: "Grade 9B", pct: 92 },
                { name: "Grade 10B", pct: 82 },
                { name: "Grade 11A", pct: 94 },
                { name: "Grade 12A", pct: 88 },
              ].map((c) => (
                <tr key={c.name} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="h-11 px-4 text-xs font-medium">{c.name}</td>
                  <td className="h-11 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full">
                        <div className={`h-full rounded-full ${c.pct >= 90 ? "bg-green-500" : c.pct >= 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="text-xs font-medium">{c.pct}%</span>
                    </div>
                  </td>
                  <td className="h-11 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${c.pct >= 90 ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {c.pct >= 90 ? "Good" : "Below Avg"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
