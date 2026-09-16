"use client";

import React, { useState, useMemo } from "react";
import { formatCurrency, formatDate } from "@schoolos/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Receipt,
  FileText,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type LedgerStreamType = "INFLOW" | "OUTFLOW" | "ADVANCE";

export interface LedgerRecord {
  id: string;
  type: LedgerStreamType;
  date: string | Date;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  receiptNo?: string;
  title: string;
  categoryOrClass: string;
  entityName?: string;
  description?: string;
  status?: string;
  raw: any;
}

interface LedgerTableProps {
  transactions: any[];
  expenses: any[];
  advances: any[];
  onViewReceipt: (receiptNo: string) => void;
}

export function LedgerTable({
  transactions = [],
  expenses = [],
  advances = [],
  onViewReceipt,
}: Readonly<LedgerTableProps>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [tableSearch, setTableSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "ALL" | "INFLOW" | "OUTFLOW" | "ADVANCE"
  >("ALL");

  // Merge datasets into a unified chronological log
  const unifiedRecords: LedgerRecord[] = useMemo(() => {
    const list: LedgerRecord[] = [];

    // 1. Transactions (Inflows)
    transactions.forEach((tx) => {
      list.push({
        id: `tx_${tx.id}`,
        type: "INFLOW",
        date: tx.date || tx.createdAt,
        amount: Number(tx.amount || 0),
        paymentMethod: tx.method || "CASH",
        referenceNo: tx.reference,
        receiptNo: tx.receiptNo,
        title: tx.student?.name
          ? `Student Fee Collection • ${tx.student.name}`
          : "Student Fee Collection",
        categoryOrClass: tx.student?.class?.name
          ? `Class ${tx.student.class.name}`
          : "Fee Collection",
        entityName: tx.student?.name,
        description:
          tx.remarks ||
          tx.allocations
            ?.map((a: any) => a.chargeItem?.component?.name)
            .filter(Boolean)
            .slice(0, 2)
            .join(", ") ||
          "Tuition & Activity Dues",
        status: tx.status || "SUCCESS",
        raw: tx,
      });
    });

    // 2. Expenses (Outflows)
    expenses.forEach((exp) => {
      list.push({
        id: `exp_${exp.id}`,
        type: "OUTFLOW",
        date: exp.date || exp.createdAt,
        amount: Number(exp.amount || 0),
        paymentMethod: exp.paymentMethod || "CASH",
        referenceNo: exp.referenceNo,
        receiptNo: exp.referenceNo ? `VOU-${exp.referenceNo}` : undefined,
        title: exp.title,
        categoryOrClass: exp.category?.name || "General Expense",
        entityName: exp.recordedBy?.name
          ? `Recorded by ${exp.recordedBy.name}`
          : undefined,
        description:
          exp.description || exp.category?.name || "Operational Expenditure",
        status: "DISBURSED",
        raw: exp,
      });
    });

    // 3. Advances
    advances.forEach((adv) => {
      list.push({
        id: `adv_${adv.id}`,
        type: "ADVANCE",
        date: adv.createdAt,
        amount: Number(adv.amount || 0),
        paymentMethod: "ADVANCE_LEDGER",
        referenceNo: undefined,
        receiptNo: undefined,
        title: adv.student?.name
          ? `Advance Balance Credit • ${adv.student.name}`
          : "Advance Settlement",
        categoryOrClass: adv.component?.name
          ? `Prepaid ${adv.component.name}`
          : "General Advance",
        entityName: adv.student?.name,
        description: adv.description || "Student Prepaid Pool Allocation",
        status: "CREDIT",
        raw: adv,
      });
    });

    // Sort newest to oldest
    return list.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });
  }, [transactions, expenses, advances]);

  // Filter records by search and local type filter
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter((rec) => {
      if (typeFilter !== "ALL" && rec.type !== typeFilter) {
        return false;
      }

      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const titleMatch = rec.title?.toLowerCase().includes(q);
        const refMatch = rec.referenceNo?.toLowerCase().includes(q);
        const receiptMatch = rec.receiptNo?.toLowerCase().includes(q);
        const entityMatch = rec.entityName?.toLowerCase().includes(q);
        const descMatch = rec.description?.toLowerCase().includes(q);
        const catMatch = rec.categoryOrClass?.toLowerCase().includes(q);
        const modeMatch = rec.paymentMethod?.toLowerCase().includes(q);

        if (
          !titleMatch &&
          !refMatch &&
          !receiptMatch &&
          !entityMatch &&
          !descMatch &&
          !catMatch &&
          !modeMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedRecords, typeFilter, tableSearch]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Summary statistics for current view
  const { totalInflow, totalOutflow, netTotal } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredRecords.forEach((r) => {
      if (r.type === "INFLOW") inflow += r.amount;
      else if (r.type === "OUTFLOW") outflow += r.amount;
    });
    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netTotal: inflow - outflow,
    };
  }, [filteredRecords]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatTime = (dateInput: string | Date) => {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden space-y-4">
      {/* Table Header Controls */}
      <div className="p-4 md:p-5 border-b space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Transaction &amp; Expense Audit Logs
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {filteredRecords.length}{" "}
                {filteredRecords.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Comprehensive chronological ledger recording all cash flows, fee
              collections, and operational expenses.
            </p>
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setTypeFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                typeFilter === "ALL"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({unifiedRecords.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("INFLOW");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                typeFilter === "INFLOW"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Collections ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("OUTFLOW");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                typeFilter === "OUTFLOW"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Expenses ({expenses.length})
            </button>
            {advances.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("ADVANCE");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  typeFilter === "ADVANCE"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Advances ({advances.length})
              </button>
            )}
          </div>
        </div>

        {/* Search & Page Size */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by receipt, student name, category, or note..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border bg-background text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-muted-foreground">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 px-2 rounded-lg border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/40 text-muted-foreground border-b uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3 font-bold">Date &amp; Time</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Ref / Receipt</th>
              <th className="px-4 py-3 font-bold">Particulars &amp; Details</th>
              <th className="px-4 py-3 font-bold">Payment Mode</th>
              <th className="px-4 py-3 text-right font-bold">Amount (₹)</th>
              <th className="px-4 py-3 text-right font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedRecords.map((rec) => {
              const isInflow = rec.type === "INFLOW";
              const isOutflow = rec.type === "OUTFLOW";
              const isAdvance = rec.type === "ADVANCE";

              return (
                <tr
                  key={rec.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  {/* Date & Time */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-bold text-foreground">
                      {formatDate(rec.date)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTime(rec.date)}
                    </p>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isInflow && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        <ArrowDownLeft className="w-3 h-3" /> Inflow
                      </span>
                    )}
                    {isOutflow && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                        <ArrowUpRight className="w-3 h-3" /> Outflow
                      </span>
                    )}
                    {isAdvance && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        <Wallet className="w-3 h-3" /> Advance
                      </span>
                    )}
                  </td>

                  {/* Reference / Receipt */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono">
                    {rec.receiptNo ? (
                      <p className="font-bold text-violet-600 dark:text-violet-400">
                        {rec.receiptNo}
                      </p>
                    ) : rec.referenceNo ? (
                      <p className="font-medium text-foreground">
                        {rec.referenceNo}
                      </p>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                    {rec.referenceNo &&
                      rec.receiptNo &&
                      rec.referenceNo !== rec.receiptNo && (
                        <p className="text-[10px] text-muted-foreground">
                          Ref: {rec.referenceNo}
                        </p>
                      )}
                  </td>

                  {/* Particulars & Details */}
                  <td className="px-4 py-3 min-w-[220px]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-foreground">{rec.title}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                          {rec.categoryOrClass}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-md">
                        {rec.description}
                      </p>
                    </div>
                  </td>

                  {/* Payment Mode */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rec.paymentMethod === "CASH"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : rec.paymentMethod === "UPI"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : rec.paymentMethod === "CHEQUE"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      }`}
                    >
                      {rec.paymentMethod.replace(/_/g, " ")}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <p
                      className={`font-black text-sm font-mono ${
                        isInflow
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isOutflow
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {isInflow && "+"}
                      {isOutflow && "-"}
                      {formatCurrency(rec.amount)}
                    </p>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isInflow && rec.receiptNo ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(rec.receiptNo!)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Receipt</span>
                      </button>
                    ) : isOutflow && rec.raw?.receiptUrl ? (
                      <a
                        href={rec.raw.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Bill</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {paginatedRecords.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="font-semibold text-sm text-foreground">
                    No records found
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No transactions or expenses match your active filter
                    criteria.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Stream Footers */}
      <div className="p-4 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Real-time Summary Cards */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">
              Filtered Inflow:
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(totalInflow)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">
              Filtered Outflow:
            </span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              -{formatCurrency(totalOutflow)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 hidden md:flex">
            <span className="text-muted-foreground font-medium">
              Net Position:
            </span>
            <span
              className={`font-black ${
                netTotal >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {netTotal >= 0 ? "+" : ""}
              {formatCurrency(netTotal)}
            </span>
          </div>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="p-1.5 rounded-lg border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="p-1.5 rounded-lg border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
