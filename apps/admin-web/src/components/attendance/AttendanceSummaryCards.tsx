"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, FileCheck } from "lucide-react";

interface SummaryData {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
}

interface AttendanceSummaryCardsProps {
  summary: SummaryData;
}

export function AttendanceSummaryCards({ summary }: AttendanceSummaryCardsProps) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const pct = total > 0 ? Math.round((summary.PRESENT / total) * 100) : 0;

  const cards = [
    { label: "Present", value: summary.PRESENT, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Absent", value: summary.ABSENT, icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
    { label: "Late", value: summary.LATE, icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Attendance Rate", value: `${pct}%`, icon: FileCheck, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="card-elevated p-4"
        >
          <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
            <card.icon size={17} className={card.color} />
          </div>
          <div className="text-2xl font-bold text-foreground">{card.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
        </motion.div>
      ))}
    </div>
  );
}
