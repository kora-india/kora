"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Clock, AlertCircle, Plus } from "lucide-react";
import { formatCurrency } from "@schoolos/utils";

interface FeesContentProps {
  fees: any[];
  summary: any[];
  canEdit: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  WAIVED: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800",
};

export function FeesContent({ fees, summary, canEdit }: FeesContentProps) {
  const [filter, setFilter] = useState("");

  const getSummaryAmt = (status: string) => {
    const entry = summary.find((s: any) => s.status === status);
    return Number(entry?._sum?.amount ?? 0);
  };
  const getSummaryCount = (status: string) => {
    const entry = summary.find((s: any) => s.status === status);
    return entry?._count?.id ?? 0;
  };

  const filtered = filter ? fees.filter((f) => f.status === filter) : fees;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fees Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track collections and pending dues</p>
        </div>
        {canEdit && (
          <button className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Collected", status: "PAID", icon: TrendingUp, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
          { label: "Pending", status: "PENDING", icon: Clock, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
          { label: "Overdue", status: "OVERDUE", icon: AlertCircle, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
          { label: "Waived", status: "WAIVED", icon: DollarSign, color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400" },
        ].map((card) => (
          <motion.div
            key={card.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setFilter(filter === card.status ? "" : card.status)}
          >
            <div className={`p-2 rounded-lg w-fit mb-3 ${card.color}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{formatCurrency(getSummaryAmt(card.status))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label} · {getSummaryCount(card.status)} records</p>
          </motion.div>
        ))}
      </div>

      {/* Fees table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-sm font-semibold">Fee Ledger</h3>
          <div className="flex gap-2">
            {["", "PENDING", "OVERDUE", "PAID"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === s ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted"}`}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Fee Type</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Amount</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Due Date</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              {canEdit && <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="h-12 px-5 text-xs font-medium">{f.student?.name}</td>
                <td className="h-12 px-4 text-xs text-muted-foreground">{f.class?.name}</td>
                <td className="h-12 px-4 text-xs">{f.feeType}</td>
                <td className="h-12 px-4 text-xs font-semibold">{formatCurrency(Number(f.amount))}</td>
                <td className="h-12 px-4 text-xs text-muted-foreground">
                  {new Date(f.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="h-12 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_BADGE[f.status]}`}>
                    {f.status}
                  </span>
                </td>
                {canEdit && (
                  <td className="h-12 px-4">
                    {f.status !== "PAID" && (
                      <button className="text-xs text-violet-600 hover:underline">Mark Paid</button>
                    )}
                    {f.status === "PAID" && (
                      <button className="text-xs text-muted-foreground hover:underline">Receipt</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="h-32 text-center text-xs text-muted-foreground">No fee records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
