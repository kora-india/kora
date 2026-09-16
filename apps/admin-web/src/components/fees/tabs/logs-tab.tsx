"use client";

import React, { useState, useMemo } from "react";
import { formatCurrency, formatDate } from "@schoolos/utils";
import {
  Search,
  ArrowDownRight,
  IndianRupee,
  History,
  FileText,
  CheckCircle2,
  Printer,
  Loader2,
  Calendar,
  CreditCard,
  Download,
  RotateCcw,
  Sparkles,
  QrCode,
  Building2,
  Wallet,
  Receipt,
  ExternalLink,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FeeReceiptModal } from "@/components/fees/fee-receipt-modal";
import {
  getFeeReceiptDetails,
  type FeeReceiptData,
} from "@/lib/actions/fee-allocator";
import { toast } from "sonner";
import { isToday, isThisMonth } from "date-fns";

interface Props {
  transactions: any[];
}

const PAYMENT_METHODS = [
  { id: "all", label: "All Modes" },
  { id: "CASH", label: "Cash" },
  { id: "UPI", label: "UPI" },
  { id: "BANK_TRANSFER", label: "Bank Wire" },
  { id: "CHEQUE", label: "Cheque" },
  { id: "CARD", label: "Card" },
];

export function LogsTab({ transactions = [] }: Readonly<Props>) {
  const [subTab, setSubTab] = useState<"transactions" | "activities">(
    "transactions",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "month">(
    "all",
  );
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const [receiptModal, setReceiptModal] = useState<{
    open: boolean;
    loadingReceiptNo: string | null;
    data: FeeReceiptData | null;
  }>({ open: false, loadingReceiptNo: null, data: null });

  const handleOpenReceipt = async (receiptNo: string) => {
    setReceiptModal((prev) => ({ ...prev, loadingReceiptNo: receiptNo }));
    try {
      const res = await getFeeReceiptDetails(receiptNo);
      if (res.success && res.data) {
        setReceiptModal({
          open: true,
          loadingReceiptNo: null,
          data: res.data,
        });
      } else {
        toast.error(res.error || "Failed to load receipt");
        setReceiptModal((prev) => ({ ...prev, loadingReceiptNo: null }));
      }
    } catch {
      toast.error("Failed to fetch receipt");
      setReceiptModal((prev) => ({ ...prev, loadingReceiptNo: null }));
    }
  };

  // Filter Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Date Filter
      if (dateFilter === "today") {
        if (!isToday(new Date(tx.date || tx.createdAt))) return false;
      } else if (dateFilter === "month") {
        if (!isThisMonth(new Date(tx.date || tx.createdAt))) return false;
      }

      // Method Filter
      if (methodFilter !== "all") {
        const m = (tx.method || "OTHER").toUpperCase();
        if (methodFilter === "CARD") {
          if (!["CARD", "CREDIT_CARD", "DEBIT_CARD"].includes(m)) return false;
        } else if (m !== methodFilter) {
          return false;
        }
      }

      // Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const receiptMatch = tx.receiptNo?.toLowerCase().includes(term);
        const nameMatch = tx.student?.name?.toLowerCase().includes(term);
        const rollMatch = tx.student?.rollNumber?.toLowerCase().includes(term);
        const refMatch = tx.reference?.toLowerCase().includes(term);
        if (!receiptMatch && !nameMatch && !rollMatch && !refMatch) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, searchTerm, methodFilter, dateFilter]);

  // Aggregate Metrics
  const totalVolume = useMemo(() => {
    return filteredTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount || 0),
      0,
    );
  }, [filteredTransactions]);

  const todayVolume = useMemo(() => {
    return transactions
      .filter((tx) => isToday(new Date(tx.date || tx.createdAt)))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [transactions]);

  const avgReceiptSize =
    filteredTransactions.length > 0
      ? totalVolume / filteredTransactions.length
      : 0;

  const upiTotal = useMemo(() => {
    return transactions
      .filter((tx) => (tx.method || "").toUpperCase() === "UPI")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [transactions]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const headers = [
      "Receipt No",
      "Date",
      "Student Name",
      "Roll Number",
      "Payment Mode",
      "Reference No",
      "Amount (INR)",
      "Status",
    ];
    const rows = filteredTransactions.map((tx) => [
      `"${tx.receiptNo}"`,
      `"${formatDate(tx.date || tx.createdAt)}"`,
      `"${(tx.student?.name || "").replace(/"/g, '""')}"`,
      `"${(tx.student?.rollNumber || "").replace(/"/g, '""')}"`,
      tx.method || "CASH",
      `"${(tx.reference || "").replace(/"/g, '""')}"`,
      Number(tx.amount || 0).toFixed(2),
      tx.status || "SUCCESS",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `schoolos-transactions-${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Transaction log exported to CSV");
  };

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP SUMMARY STRIP                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Logged
            </p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalVolume)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {filteredTransactions.length} of {transactions.length} receipts
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Collections */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collected Today
            </p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(todayVolume)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Same-day collection intake
            </p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Average Receipt Size */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Receipt
            </p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(avgReceiptSize)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Per recorded payment
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Digital / UPI Intake */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              UPI Volume
            </p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(upiTotal)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Instant digital payments
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <QrCode className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUB-NAVIGATION PILLS                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl w-fit border shadow-sm">
        <button
          type="button"
          onClick={() => setSubTab("transactions")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            subTab === "transactions"
              ? "bg-background text-violet-700 dark:text-violet-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Fee Transactions Ledger
        </button>

        <button
          type="button"
          onClick={() => setSubTab("activities")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            subTab === "activities"
              ? "bg-background text-violet-700 dark:text-violet-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          System Activity Trail
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TRANSACTIONS VIEW                                          */}
      {/* ------------------------------------------------------------- */}
      {subTab === "transactions" && (
        <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
            {/* Search */}
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search receipt, student, UTR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>

            {/* Filter Pills & Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Filter Pills */}
              <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDateFilter("all")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    dateFilter === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter("today")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    dateFilter === "today"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter("month")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    dateFilter === "month"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  This Month
                </button>
              </div>

              {/* Method Selector */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer font-medium"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-xl hover:bg-muted transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="border rounded-xl overflow-hidden bg-background">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Receipt No</th>
                  <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Payment Mode</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Amount Paid
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTransactions.map((tx: any) => {
                  const isPartialTx = tx.allocations?.some(
                    (a: any) =>
                      a.chargeItem?.charge?.status !== "PAID" &&
                      a.chargeItem?.status !== "PAID",
                  );
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-violet-600 dark:text-violet-400">
                        <div className="flex items-center gap-1.5">
                          <span>{tx.receiptNo}</span>
                          {isPartialTx ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                              Invoice
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                              Bill
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(tx.date || tx.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">
                          {tx.student?.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Roll: {tx.student?.rollNumber || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            tx.method === "CASH"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : tx.method === "UPI"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : tx.method === "CHEQUE"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}
                        >
                          {tx.method || "CASH"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground truncate max-w-[120px]">
                        {tx.reference || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {formatCurrency(Number(tx.amount))}
                        </div>
                        {tx.allocations?.some(
                          (a: any) =>
                            a.chargeItem?.component?.category === "LATE_FEE",
                        ) && (
                          <span className="inline-block mt-0.5 text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-1.5 py-0.2 rounded font-bold uppercase">
                            Late Fine Included
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(tx.receiptNo)}
                          disabled={
                            receiptModal.loadingReceiptNo === tx.receiptNo
                          }
                          className="p-1.5 text-muted-foreground hover:text-violet-600 hover:bg-muted rounded-lg transition-colors cursor-pointer"
                          title={
                            isPartialTx
                              ? "Print Dues Invoice"
                              : "Print Official Clearance Bill"
                          }
                        >
                          {receiptModal.loadingReceiptNo === tx.receiptNo ? (
                            <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                          ) : (
                            <Printer className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm font-bold text-foreground">
                        No transactions found
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        There are no fee collection transactions matching your
                        search criteria.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. ACTIVITIES VIEW                                            */}
      {/* ------------------------------------------------------------- */}
      {subTab === "activities" && (
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Institutional Financial Activity Trail
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit log of fee generations, structure updates, and
                collections.
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">
                  Transaction Audit Logs Synchronized
                </p>
                <p className="text-xs text-muted-foreground">
                  All payment transactions are mathematically reconciled and
                  stored with immutable receipt numbers.
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Status: Reconciled Live
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">
                  Automatic Advance Settler Active
                </p>
                <p className="text-xs text-muted-foreground">
                  Negative ledger adjustments automatically deduct against newly
                  generated dues upon bill creation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TRANSACTION DETAILS MODAL                                   */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={!!selectedTx}
        onOpenChange={(open) => !open && setSelectedTx(null)}
        title="Transaction Details"
      >
        {selectedTx && (
          <div className="space-y-5 text-xs">
            {/* Summary Box */}
            <div className="bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 p-4 rounded-xl flex justify-between items-center">
              <div>
                <p className="text-muted-foreground mb-0.5">
                  Total Amount Paid
                </p>
                <p className="text-2xl font-black text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                  {formatCurrency(Number(selectedTx.amount))}
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-foreground">
                  {selectedTx.receiptNo}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {formatDate(selectedTx.date || selectedTx.createdAt)}
                </p>
              </div>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-xl border">
              <div>
                <p className="text-muted-foreground text-[11px]">Student</p>
                <p className="font-bold text-foreground">
                  {selectedTx.student?.name}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">Roll Number</p>
                <p className="font-bold text-foreground">
                  {selectedTx.student?.rollNumber || "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">
                  Payment Mode
                </p>
                <p className="font-bold text-foreground uppercase">
                  {selectedTx.method}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">
                  Reference / UTR
                </p>
                <p className="font-mono text-foreground">
                  {selectedTx.reference || "-"}
                </p>
              </div>
            </div>

            {/* Allocations Breakdown */}
            <div>
              <h4 className="font-bold mb-2 flex items-center gap-1.5 text-xs text-foreground">
                <FileText className="w-3.5 h-3.5 text-violet-600" />
                Allocated Fee Components
              </h4>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">
                        Component
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Due Period
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Allocated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedTx.allocations?.map((alloc: any) => (
                      <tr key={alloc.id} className="bg-card">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {alloc.chargeItem?.component?.name || "Component"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {alloc.chargeItem?.charge?.title || "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-600">
                          {formatCurrency(Number(alloc.amount))}
                        </td>
                      </tr>
                    ))}
                    {(!selectedTx.allocations ||
                      selectedTx.allocations.length === 0) && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          No specific allocations (Advance deposit).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Document Button */}
            <div className="flex justify-end pt-2 border-t">
              {(() => {
                const isPartial = selectedTx.allocations?.some(
                  (a: any) =>
                    a.chargeItem?.charge?.status !== "PAID" &&
                    a.chargeItem?.status !== "PAID",
                );
                return (
                  <button
                    type="button"
                    onClick={() => handleOpenReceipt(selectedTx.receiptNo)}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer ${
                      isPartial
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      {isPartial
                        ? "Print Dues Invoice"
                        : "Print Official Clearance Bill"}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </Dialog>

      {/* Official Receipt Modal */}
      <FeeReceiptModal
        isOpen={receiptModal.open}
        onClose={() =>
          setReceiptModal({ open: false, loadingReceiptNo: null, data: null })
        }
        receiptData={receiptModal.data}
      />
    </div>
  );
}
