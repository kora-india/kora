"use client";

import { motion } from "framer-motion";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { formatCurrency } from "@schoolos/utils";

const revenueData = [
  { month: "Nov", collected: 1420000, pending: 180000 },
  { month: "Dec", collected: 1650000, pending: 120000 },
  { month: "Jan", collected: 1580000, pending: 200000 },
  { month: "Feb", collected: 1720000, pending: 90000 },
  { month: "Mar", collected: 1800000, pending: 150000 },
  { month: "Apr", collected: 1860000, pending: 240000 },
];

const attendanceData = [
  { month: "Nov", rate: 88 },
  { month: "Dec", rate: 85 },
  { month: "Jan", rate: 91 },
  { month: "Feb", rate: 93 },
  { month: "Mar", rate: 89 },
  { month: "Apr", rate: 91 },
];

const feeDistribution = [
  { name: "Tuition", value: 65, color: "#7c3aed" },
  { name: "Annual", value: 20, color: "#3b82f6" },
  { name: "Sports", value: 10, color: "#22c55e" },
  { name: "Other", value: 5, color: "#f59e0b" },
];

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">School performance overview — AY 2024-25</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fee Collection Trend</h3>
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
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Attendance Rate Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(val: number) => [`${val}%`, "Attendance"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fee Distribution by Type</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={feeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {feeDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`${val}%`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {feeDistribution.map((f) => (
                <div key={f.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                  <span className="text-xs text-muted-foreground">{f.name}</span>
                  <span className="text-xs font-semibold ml-auto">{f.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Key Metrics — April 2025</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Revenue", value: "₹18.6L", sub: "+8.4% vs last month", color: "text-green-600" },
              { label: "Fee Collection Rate", value: "73.2%", sub: "267 paid of 365", color: "text-violet-600" },
              { label: "Avg Attendance", value: "91.2%", sub: "1,170 avg present/day", color: "text-blue-600" },
              { label: "New Enrolments", value: "+12", sub: "YTD: 1,284 students", color: "text-amber-600" },
            ].map((m) => (
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
