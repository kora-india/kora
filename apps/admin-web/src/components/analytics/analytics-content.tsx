"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { formatCurrency } from "@schoolos/utils";

// Validated categorical palette (blue, orange, aqua, yellow, magenta), "Other" gets muted gray.
const SLICE_COLORS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const SLICE_COLORS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const OTHER_COLOR = "#898781";

interface Props {
  revenueData: { month: string; collected: number; pending: number }[];
  attendanceData: { month: string; rate: number }[];
  feeDistribution: { name: string; value: number }[];
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

export function AnalyticsContent({ revenueData, attendanceData, feeDistribution, metrics }: Readonly<Props>) {
  const { resolvedTheme } = useTheme();
  const sliceColors = resolvedTheme === "dark" ? SLICE_COLORS_DARK : SLICE_COLORS_LIGHT;

  const keyMetrics = [
    {
      label: "Total Revenue",
      value: formatCurrency(metrics.totalRevenue),
      sub: metrics.revenueChangePct === null ? "This month" : `${metrics.revenueChangePct >= 0 ? "+" : ""}${metrics.revenueChangePct}% vs last month`,
      color: metrics.revenueChangePct === null || metrics.revenueChangePct >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      label: "Fee Collection Rate",
      value: `${metrics.feeCollectionRate}%`,
      sub: `${metrics.paidFeeCount} paid of ${metrics.totalFeeCount}`,
      color: "text-violet-600",
    },
    {
      label: "Avg Attendance",
      value: `${metrics.avgAttendanceRate}%`,
      sub: `${metrics.avgPresentPerDay} avg present/day`,
      color: "text-blue-600",
    },
    {
      label: "New Enrolments",
      value: `+${metrics.newEnrolments}`,
      sub: `Active: ${metrics.activeStudentCount} students`,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">School performance overview</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fee Collection Trend</h3>
          {revenueData.every((d) => d.collected === 0 && d.pending === 0) ? (
            <EmptyChart label="No fee activity in the last 6 months" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val: number) => [formatCurrency(val), ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="collected" name="Collected" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Attendance Rate Trend</h3>
          {attendanceData.every((d) => d.rate === 0) ? (
            <EmptyChart label="No attendance records in the last 6 months" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val: number) => [`${val}%`, "Attendance"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fee Distribution by Type</h3>
          {feeDistribution.length === 0 ? (
            <EmptyChart label="No fee records yet" />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={feeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {feeDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.name === "Other" ? OTHER_COLOR : sliceColors[index % sliceColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`${val}%`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {feeDistribution.map((f, index) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.name === "Other" ? OTHER_COLOR : sliceColors[index % sliceColors.length] }} />
                    <span className="text-xs text-muted-foreground">{f.name}</span>
                    <span className="text-xs font-semibold ml-auto">{f.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            {keyMetrics.map((m) => (
              <div key={m.label} className="bg-muted/40 rounded-xl p-4">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs font-medium mt-0.5">{m.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{m.sub}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: Readonly<{ label: string }>) {
  return (
    <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
