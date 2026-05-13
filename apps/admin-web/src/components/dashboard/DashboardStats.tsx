"use client";

import { motion } from "framer-motion";
import { Users, GraduationCap, DollarSign, ClipboardCheck, TrendingUp } from "lucide-react";
import { formatCompactCurrency } from "@schoolos/utils";

interface StatsData {
  totalStudents: number;
  totalTeachers: number;
  pendingFeesCount: number;
  pendingFeesAmount: number;
  attendancePct: number;
  presentToday: number;
  totalToday: number;
}

interface DashboardStatsProps {
  stats: StatsData;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards = [
    {
      label: "Total Students",
      value: stats.totalStudents.toLocaleString(),
      icon: GraduationCap,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      trend: "+12 this month",
      trendUp: true,
    },
    {
      label: "Teaching Staff",
      value: stats.totalTeachers.toString(),
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      trend: "Active staff",
      trendUp: true,
    },
    {
      label: "Pending Fees",
      value: formatCompactCurrency(stats.pendingFeesAmount),
      icon: DollarSign,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      trend: `${stats.pendingFeesCount} students due`,
      trendUp: false,
    },
    {
      label: "Today's Attendance",
      value: `${stats.attendancePct}%`,
      icon: ClipboardCheck,
      color: stats.attendancePct >= 90 ? "text-green-500" : stats.attendancePct >= 75 ? "text-amber-500" : "text-red-500",
      bg: stats.attendancePct >= 90 ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30",
      trend: `${stats.presentToday}/${stats.totalToday} present`,
      trendUp: stats.attendancePct >= 85,
    },
    {
      label: "Monthly Revenue",
      value: formatCompactCurrency(stats.pendingFeesAmount * 8), // placeholder
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      trend: "+8.4% vs last month",
      trendUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.4 }}
          className="card-elevated p-4 cursor-default"
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon size={17} className={card.color} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground tracking-tight">{card.value}</div>
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className={`text-xs flex items-center gap-1 ${card.trendUp ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {card.trend}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
