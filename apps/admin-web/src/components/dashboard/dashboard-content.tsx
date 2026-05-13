"use client";

import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Users, GraduationCap, DollarSign, Calendar, TrendingUp, BookOpen, AlertCircle, Bell } from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import { UserRole } from "@schoolos/types";

const stagger = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } },
  item: { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } },
};

interface DashboardContentProps {
  data: any;
  userRole: UserRole;
  userName: string;
}

function StatCard({ title, value, icon: Icon, trend, color }: any) {
  return (
    <motion.div variants={stagger.item} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{title}</p>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          <TrendingUp className="w-3 h-3" />
          {trend.label}
        </div>
      )}
    </motion.div>
  );
}

export function DashboardContent({ data, userRole, userName }: DashboardContentProps) {
  const stats = data?.stats;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold"
          >
            {greeting}, {userName.split(" ")[0]} 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1 } }}
            className="text-muted-foreground text-sm mt-1"
          >
            Delhi Public School · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </motion.p>
        </div>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          New Notice
        </motion.button>
      </div>

      {/* Stats grid */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
      >
        <StatCard
          title="Total Students"
          value={stats?.totalStudents?.toLocaleString() ?? "1,284"}
          icon={Users}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          trend={{ up: true, label: "+12 this month" }}
        />
        <StatCard
          title="Teaching Staff"
          value={stats?.totalTeachers ?? "87"}
          icon={GraduationCap}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          trend={{ up: true, label: "+3 new joined" }}
        />
        <StatCard
          title="Pending Fees"
          value={formatCurrency(stats?.pendingFees ?? 240000)}
          icon={DollarSign}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          trend={{ up: false, label: "48 students" }}
        />
        <StatCard
          title="Attendance Today"
          value={`${stats?.attendancePercentage ?? 91}%`}
          icon={Calendar}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          trend={{ up: true, label: "+1.8% vs yesterday" }}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats?.monthlyRevenue ?? 1860000)}
          icon={TrendingUp}
          color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          trend={{ up: true, label: "+8.4% vs last month" }}
        />
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
          className="xl:col-span-2 rounded-xl border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Fee Collection</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">2024-25</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data?.revenueData ?? mockRevenue} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val: number) => [formatCurrency(val), ""]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#7c3aed" strokeWidth={2} fill="url(#collected)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Attendance overview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
          className="rounded-xl border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Attendance Overview</h3>
          </div>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 40 * 0.912} ${2 * Math.PI * 40}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">91%</span>
                <span className="text-[10px] text-muted-foreground">Present</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Grade 8A", pct: 96, color: "bg-green-500" },
              { label: "Grade 10B", pct: 82, color: "bg-amber-500" },
              { label: "Grade 12A", pct: 94, color: "bg-green-500" },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-muted-foreground truncate">{c.label}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full">
                  <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                </div>
                <span className="font-medium w-8 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent students */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
          className="xl:col-span-2 rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between p-5 border-b">
            <h3 className="text-sm font-semibold">Recent Students</h3>
            <a href="/students" className="text-xs text-violet-600 hover:underline">View all →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-9 px-5 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
                  <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
                  <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Fee</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentStudents ?? mockStudents).map((s: any) => (
                  <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="h-11 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                          {s.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-xs font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="h-11 px-4 text-xs text-muted-foreground">{s.class?.name ?? "Grade 8"} · {s.section?.name ?? "A"}</td>
                    <td className="h-11 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        s.fees?.[0]?.status === "PAID" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800" :
                        s.fees?.[0]?.status === "OVERDUE" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" :
                        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
                      }`}>
                        {s.fees?.[0]?.status ?? "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Notices */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.45 } }}
          className="rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between p-5 border-b">
            <h3 className="text-sm font-semibold">Recent Notices</h3>
            <a href="/notices" className="text-xs text-violet-600 hover:underline">All →</a>
          </div>
          <div className="divide-y">
            {(data?.notices ?? mockNotices).map((n: any) => (
              <div key={n.id} className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    n.priority === "HIGH" ? "bg-red-500" :
                    n.priority === "MEDIUM" ? "bg-amber-500" : "bg-green-500"
                  }`} />
                  <div>
                    <p className="text-xs font-medium leading-tight">{n.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{n.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!data?.notices || data.notices.length === 0) && (
              <div className="p-6 text-center text-xs text-muted-foreground">No notices yet</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const mockRevenue = [
  { month: "Nov", collected: 1420000, pending: 180000 },
  { month: "Dec", collected: 1650000, pending: 120000 },
  { month: "Jan", collected: 1580000, pending: 200000 },
  { month: "Feb", collected: 1720000, pending: 90000 },
  { month: "Mar", collected: 1800000, pending: 150000 },
  { month: "Apr", collected: 1860000, pending: 240000 },
];

const mockStudents = [
  { id: "1", name: "Priya Sharma", class: { name: "Grade 10" }, section: { name: "A" }, fees: [{ status: "PAID" }] },
  { id: "2", name: "Rohan Mehta", class: { name: "Grade 8" }, section: { name: "B" }, fees: [{ status: "PENDING" }] },
  { id: "3", name: "Ananya Gupta", class: { name: "Grade 12" }, section: { name: "A" }, fees: [{ status: "PAID" }] },
  { id: "4", name: "Vikram Singh", class: { name: "Grade 9" }, section: { name: "C" }, fees: [{ status: "OVERDUE" }] },
  { id: "5", name: "Sneha Patel", class: { name: "Grade 11" }, section: { name: "B" }, fees: [{ status: "PAID" }] },
];

const mockNotices = [
  { id: "1", title: "Annual Sports Day — 20 May 2025", content: "All students required to participate. Report in sports attire by 7:30 AM.", priority: "HIGH" },
  { id: "2", title: "Mid-Term Exam Schedule", content: "Examinations from June 2–10. Timetable available on portal.", priority: "MEDIUM" },
  { id: "3", title: "Parent-Teacher Meeting", content: "PT Meeting on Saturday, May 25 for Grade 10 & 12.", priority: "LOW" },
];
