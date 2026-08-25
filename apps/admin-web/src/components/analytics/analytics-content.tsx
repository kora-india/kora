"use client";

import React from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@schoolos/utils";
import {
  AntvRevenueAreaChart,
  AntvAttendanceLineChart,
  AntvFeePieChart,
  AntvPaymentMethodsBarChart,
} from "./antv-charts";
import {
  IndianRupee,
  TrendingUp,
  Users,
  CalendarCheck,
  CreditCard,
  PieChart as PieIcon,
  BarChart3,
} from "lucide-react";

interface Props {
  revenueData: { month: string; collected: number; pending: number }[];
  revenueAreaData: { month: string; type: string; amount: number }[];
  attendanceData: { month: string; rate: number; totalRecords?: number }[];
  feeDistribution: { name: string; value: number; percentage: number }[];
  paymentMethods: { method: string; amount: number }[];
  metrics: {
    totalRevenue: number;
    revenueChangePct: number | null;
    feeCollectionRate: number;
    paidFeeCount: number;
    totalFeeCount: number;
    avgAttendanceRate: number;
    avgPresentPerDay: number;
    newEnrolments: number;
    activeStudentCount: number;
  };
}

export function AnalyticsContent({
  revenueData,
  revenueAreaData,
  attendanceData,
  feeDistribution,
  paymentMethods,
  metrics,
}: Readonly<Props>) {
  const keyMetrics = [
    {
      label: "Total Revenue",
      value: formatCurrency(metrics.totalRevenue),
      sub:
        metrics.revenueChangePct === null
          ? "This month"
          : `${metrics.revenueChangePct >= 0 ? "+" : ""}${metrics.revenueChangePct}% vs last month`,
      color:
        metrics.revenueChangePct === null || metrics.revenueChangePct >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      icon: IndianRupee,
      bg: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Fee Collection Rate",
      value: `${metrics.feeCollectionRate}%`,
      sub: `${metrics.paidFeeCount} paid items of ${metrics.totalFeeCount}`,
      color: "text-violet-600 dark:text-violet-400",
      icon: TrendingUp,
      bg: "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Avg Attendance",
      value: `${metrics.avgAttendanceRate}%`,
      sub: `${metrics.avgPresentPerDay} avg present/day`,
      color: "text-blue-600 dark:text-blue-400",
      icon: CalendarCheck,
      bg: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Enrolled Students",
      value: `${metrics.activeStudentCount}`,
      sub: `+${metrics.newEnrolments} joined in last 30 days`,
      color: "text-amber-600 dark:text-amber-400",
      icon: Users,
      bg: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400",
    },
  ];

  const hasRevenueData = revenueAreaData.some((d) => d.amount > 0);
  const hasAttendanceData = attendanceData.some((d) => (d.totalRecords ?? 0) > 0 || d.rate > 0);
  const hasFeeDistribution = feeDistribution.length > 0 && feeDistribution.some((d) => d.value > 0);
  const hasPaymentMethods = paymentMethods.length > 0 && paymentMethods.some((d) => d.amount > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">Analytics & Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time institutional performance metrics and financial intelligence
        </p>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {keyMetrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl border bg-card p-4 shadow-sm flex items-start justify-between"
            >
              <div>
                <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{m.sub}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${m.bg}`}>
                <Icon className="w-5 h-5" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Primary Charts Grid: Area Chart & Line Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* AntV Area Chart: Fee Collection vs Pending Trend */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-violet-600" /> Fee Collection & Dues Trend
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly revenue collected vs outstanding pending balance (AntV Area)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1 text-violet-600">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Collected
              </span>
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
              </span>
            </div>
          </div>

          {hasRevenueData ? (
            <AntvRevenueAreaChart data={revenueAreaData} />
          ) : (
            <EmptyChart label="No recorded fee transactions in the last 6 months" />
          )}
        </motion.div>

        {/* AntV Line Chart: Attendance Rate Trend */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-600" /> Attendance Rate Trend
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly student presence rate progression across all classes (AntV Line)
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
              {metrics.avgAttendanceRate}% Current
            </span>
          </div>

          {hasAttendanceData ? (
            <AntvAttendanceLineChart data={attendanceData} />
          ) : (
            <EmptyChart label="No attendance marked in the last 6 months" />
          )}
        </motion.div>
      </div>

      {/* Secondary Charts Grid: Component Donut Chart & Payment Methods Column Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* AntV Pie / Donut Chart: Fee Component Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
          className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-violet-600" /> Fee Component Distribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown of fee structures by component type (AntV Donut)
              </p>
            </div>
          </div>

          {hasFeeDistribution ? (
            <AntvFeePieChart data={feeDistribution} />
          ) : (
            <EmptyChart label="No fee component structures configured yet" />
          )}
        </motion.div>

        {/* AntV Column Chart: Payment Methods Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
          className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" /> Payment Methods Breakdown
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revenue collected by payment mode (Cash, UPI, Bank Transfer)
              </p>
            </div>
          </div>

          {hasPaymentMethods ? (
            <AntvPaymentMethodsBarChart data={paymentMethods} />
          ) : (
            <EmptyChart label="No completed payments recorded yet" />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: Readonly<{ label: string }>) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
      <p>{label}</p>
    </div>
  );
}
