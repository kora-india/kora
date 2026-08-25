"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  GraduationCap,
  IndianRupee,
  CalendarCheck,
  TrendingUp,
  CreditCard,
  Bell,
  ArrowUpRight,
  Plus,
  ArrowRight,
  UserPlus,
  Receipt,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import { UserRole } from "@schoolos/types";
import { AntvRevenueAreaChart } from "@/components/analytics/antv-charts";

const stagger = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  },
};

const FEE_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  WAIVED: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800",
  "NO DUES": "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
};

interface DashboardContentProps {
  data: any;
  userRole: UserRole;
  userName: string;
}

function StatCard({ title, value, icon: Icon, trend, color, href }: any) {
  const content = (
    <motion.div
      variants={stagger.item}
      className="rounded-xl border bg-card p-4 hover:shadow-sm transition-all hover:border-violet-300 dark:hover:border-violet-700 flex flex-col justify-between h-full group"
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {href && (
          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{title}</p>
        {trend && (
          <div
            className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${
              trend.up ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {trend.label}
          </div>
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export function DashboardContent({ data, userRole, userName }: Readonly<DashboardContentProps>) {
  const stats = data?.stats;
  const revenueAreaData = data?.revenueAreaData || [];
  const classAttendance = data?.classAttendance || [];
  const recentStudents = data?.recentStudents || [];
  const notices = data?.notices || [];

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";

  const hasRevenueData = revenueAreaData.some((d: any) => d.amount > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight flex items-center gap-2"
          >
            {greeting}, {userName?.split(" ")[0] || "Admin"} 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08 } }}
            className="text-muted-foreground text-xs sm:text-sm mt-1"
          >
            {data?.schoolName || "SchoolOS"} ·{" "}
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2.5 flex-wrap"
        >
          <Link
            href="/students"
            className="flex items-center gap-1.5 h-9 px-3.5 bg-background border rounded-lg text-xs font-medium hover:bg-muted transition-colors shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5 text-violet-600" />
            Add Student
          </Link>
          <Link
            href="/fees"
            className="flex items-center gap-1.5 h-9 px-3.5 bg-background border rounded-lg text-xs font-medium hover:bg-muted transition-colors shadow-sm"
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            Collect Fee
          </Link>
          <Link
            href="/notices"
            className="flex items-center gap-1.5 h-9 px-4 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Bell className="w-3.5 h-3.5" />
            New Notice
          </Link>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        <StatCard
          title="Total Students"
          value={stats?.totalStudents?.toLocaleString() || "0"}
          icon={Users}
          color="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          trend={{ up: true, label: `Active enrollment` }}
          href="/students"
        />
        <StatCard
          title="Teaching Staff"
          value={stats?.totalTeachers?.toLocaleString() || "0"}
          icon={GraduationCap}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          trend={{ up: true, label: `${stats?.activeClasses || 0} active classes` }}
          href="/teachers"
        />
        <StatCard
          title="Pending Fees"
          value={formatCurrency(stats?.pendingFees || 0)}
          icon={IndianRupee}
          color="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          trend={{ up: false, label: "Outstanding Dues" }}
          href="/fees"
        />
        <StatCard
          title="Attendance Today"
          value={`${stats?.attendancePercentage || 0}%`}
          icon={CalendarCheck}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          trend={{ up: true, label: "Daily presence" }}
          href="/attendance"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats?.monthlyRevenue || 0)}
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          trend={{ up: true, label: "Collected in Aug" }}
          href="/analytics"
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats?.monthlyExpenses || 0)}
          icon={CreditCard}
          color="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          trend={{ up: false, label: "Operational cost" }}
          href="/expenses"
        />
      </motion.div>

      {/* Main Visuals Row: AntV Area Chart & Attendance Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* AntV Area Chart: Fee Collection vs Pending Dues */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
          className="xl:col-span-2 rounded-xl border bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-violet-600" /> Fee Collection & Financial Trend
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly revenue collected vs operational expenses & pending balances (AntV Area)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Collected
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Expenses
              </span>
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
              </span>
            </div>
          </div>

          {hasRevenueData ? (
            <AntvRevenueAreaChart data={revenueAreaData} height={230} />
          ) : (
            <div className="h-[230px] flex flex-col items-center justify-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
              No recorded fee transactions in the last 6 months
            </div>
          )}
        </motion.div>

        {/* Attendance Overview Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
          className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-emerald-600" /> Attendance Overview
              </h3>
              <Link href="/attendance" className="text-xs text-violet-600 hover:underline font-medium">
                Details →
              </Link>
            </div>

            {/* Circular Progress Gauge */}
            <div className="flex items-center justify-center my-3">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="9"
                    strokeDasharray={`${
                      2 * Math.PI * 40 * ((stats?.attendancePercentage || 0) / 100)
                    } ${2 * Math.PI * 40}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-foreground">
                    {stats?.attendancePercentage || 0}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Present
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Class-wise Attendance Bars */}
          <div className="space-y-2.5 pt-3 border-t">
            {classAttendance.length > 0 ? (
              classAttendance.map((c: any) => (
                <div key={c.label} className="space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>{c.label}</span>
                    <span className="font-semibold text-foreground">{c.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        c.pct >= 90
                          ? "bg-emerald-500"
                          : c.pct >= 75
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, c.pct))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                No class attendance recorded today
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row: Recent Students & Recent Notices */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent Students Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
          className="xl:col-span-2 rounded-xl border bg-card shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-600" /> Recent Students
            </h3>
            <Link
              href="/students"
              className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 hover:underline"
            >
              View all students <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="h-9 px-4 text-left font-medium uppercase">Student</th>
                  <th className="h-9 px-4 text-left font-medium uppercase">Class & Section</th>
                  <th className="h-9 px-4 text-left font-medium uppercase">Fee Status</th>
                  <th className="h-9 px-4 text-right font-medium uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentStudents.map((s: any) => {
                  const feeStatus = s.feeCharges?.[0]?.status || "NO DUES";
                  const badgeCls = FEE_BADGE[feeStatus] || FEE_BADGE.PAID;

                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="h-12 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 flex-shrink-0">
                            {s.name
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold block">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Roll #{s.rollNumber || "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="h-12 px-4 text-xs text-muted-foreground font-medium">
                        {s.class?.name || "Class"} · {s.section?.name || "A"}
                      </td>
                      <td className="h-12 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeCls}`}
                        >
                          {feeStatus}
                        </span>
                      </td>
                      <td className="h-12 px-4 text-right">
                        <Link
                          href="/students"
                          className="text-xs text-violet-600 hover:text-violet-700 font-medium inline-flex items-center gap-1 hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {recentStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      No enrolled students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recent Notices */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
          className="rounded-xl border bg-card shadow-sm flex flex-col justify-between overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between p-4 border-b bg-muted/20">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-violet-600" /> Recent Notices
              </h3>
              <Link
                href="/notices"
                className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 hover:underline"
              >
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y max-h-[280px] overflow-y-auto">
              {notices.map((n: any) => (
                <Link
                  key={n.id}
                  href="/notices"
                  className="block p-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        n.priority === "HIGH"
                          ? "bg-rose-500"
                          : n.priority === "MEDIUM"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold truncate">{n.title}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(n.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {notices.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <FileText className="w-6 h-6 text-muted-foreground opacity-40" />
                  <p>No notices published yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border-t bg-muted/10 text-center">
            <Link
              href="/notices"
              className="text-xs text-violet-600 hover:text-violet-700 font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Publish New Notice
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
