"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button, ConfigProvider, theme as antTheme } from "antd";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import dayjs from "dayjs";
import { LedgerFilterBar, type LedgerFilterState } from "./ledger-filter-bar";
import { LedgerStatCards, type LedgerMetrics } from "./ledger-stat-cards";
import { LedgerTable } from "./ledger-table";
import { FeeReceiptModal } from "@/components/fees/fee-receipt-modal";
import {
  getFeeReceiptDetails,
  type FeeReceiptData,
} from "@/lib/actions/fee-allocator";
import {
  DEFAULT_LEDGER_QUERY,
  LEDGER_MAX_ROWS,
  LEDGER_PAGE_SIZE,
  ledgerQueryToSearch,
  type LedgerQuery,
} from "@/lib/reports/ledger-query";
import type { LedgerTotals } from "@/lib/reports/ledger";

interface Props {
  school: { name?: string; currency?: string } | null;
  /** The filters the server applied (from the URL). */
  query: LedgerQuery;
  /** Totals over every matching row. */
  metrics: LedgerMetrics;
  /** Matching rows per stream; the lists below hold the newest `query.limit`. */
  totals: LedgerTotals;
  transactions: any[];
  advanceLedgers: any[];
  expenses: any[];
  academicSessions: any[];
  classes: any[];
  feeComponents: any[];
  expenseCategories: any[];
  userRole: string;
}

// Advance settlements (status ADJUSTMENT) move money a student already paid
// onto a new charge. They count toward per-component allocation, but not as
// new collections, or the same rupee would be counted twice.
const isCollection = (tx: any) => tx.status !== "ADJUSTMENT";

const toFilters = (q: LedgerQuery): LedgerFilterState => ({
  search: q.q,
  datePreset: q.period,
  customDateRange:
    q.period === "custom" && (q.from || q.to)
      ? [q.from ? dayjs(q.from) : null, q.to ? dayjs(q.to) : null]
      : null,
  stream: q.stream,
  paymentMethod: q.method,
  sessionId: q.sessionId,
  classId: q.classId,
  componentOrCategory: q.item,
});

const toQuery = (f: LedgerFilterState, limit: number): LedgerQuery => {
  const [from, to] = f.customDateRange ?? [null, null];
  return {
    period: f.datePreset,
    from: f.datePreset === "custom" && from ? from.format("YYYY-MM-DD") : null,
    to: f.datePreset === "custom" && to ? to.format("YYYY-MM-DD") : null,
    stream: f.stream,
    method: f.paymentMethod,
    sessionId: f.sessionId,
    classId: f.classId,
    item: f.componentOrCategory,
    q: f.search,
    limit,
  };
};

export function LedgerContent({
  school,
  query,
  metrics: calculatedMetrics,
  totals,
  transactions,
  advanceLedgers,
  expenses,
  academicSessions,
  classes,
  feeComponents,
  expenseCategories,
  userRole,
}: Readonly<Props>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState<{
    open: boolean;
    data: FeeReceiptData | null;
  }>({ open: false, data: null });

  const handleOpenReceipt = async (receiptNo: string) => {
    try {
      const res = await getFeeReceiptDetails(receiptNo);
      if (res.success && res.data) {
        setReceiptModal({ open: true, data: res.data });
      } else {
        toast.error(res.error || "Failed to load receipt");
      }
    } catch {
      toast.error("Failed to fetch receipt details");
    }
  };

  // Filter State. The server filters (P2): each change updates the URL and
  // the page re-renders with matching rows and totals.
  const [filters, setFiltersState] = useState<LedgerFilterState>(() =>
    toFilters(query),
  );
  // The filter bar can fire two changes in a row (preset, then range), so
  // each change builds on the latest filters, not on this render's.
  const latestFilters = useRef(filters);
  const setFilters = (next: LedgerFilterState) => {
    latestFilters.current = next;
    setFiltersState(next);
  };
  const requested = useRef(ledgerQueryToSearch(query));
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const navigate = (next: LedgerQuery) => {
    const search = ledgerQueryToSearch(next);
    if (search === requested.current) return;
    requested.current = search;
    startTransition(() => {
      router.replace(`${pathname}${search}`, { scroll: false });
    });
  };

  // The URL changed from outside (a link, back/forward): show its filters.
  const appliedSearch = ledgerQueryToSearch(query);
  useEffect(() => {
    if (appliedSearch !== requested.current) {
      requested.current = appliedSearch;
      setFilters(toFilters(query));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const handleFilterChange = <K extends keyof LedgerFilterState>(
    key: K,
    value: LedgerFilterState[K],
  ) => {
    const next = { ...latestFilters.current, [key]: value };
    setFilters(next);
    clearTimeout(searchTimer.current);
    // A new filter starts again from the first page of rows.
    const go = () => navigate(toQuery(next, LEDGER_PAGE_SIZE));
    // Typing waits for a pause; picking a custom period waits for dates.
    if (key === "search") searchTimer.current = setTimeout(go, 400);
    else if (!(next.datePreset === "custom" && !next.customDateRange)) go();
  };

  const handleResetFilters = () => {
    clearTimeout(searchTimer.current);
    setFilters(toFilters(DEFAULT_LEDGER_QUERY));
    navigate(DEFAULT_LEDGER_QUERY);
  };

  const shownCount =
    transactions.length + expenses.length + advanceLedgers.length;
  const matchingCount = totals.transactions + totals.expenses + totals.advances;
  const truncated = shownCount < matchingCount;
  const canLoadMore = truncated && query.limit < LEDGER_MAX_ROWS;

  const handleLoadMore = () =>
    navigate({
      ...query,
      limit: Math.min(query.limit + LEDGER_PAGE_SIZE, LEDGER_MAX_ROWS),
    });

  // Extract all distinct payment methods from existing records + standard defaults
  const availablePaymentMethods = useMemo(() => {
    const methods = new Set<string>([
      "CASH",
      "UPI",
      "BANK_TRANSFER",
      "CHEQUE",
      "DEBIT_CARD",
      "CREDIT_CARD",
      "ONLINE",
      "NEFT",
      "RTGS",
      "IMPS",
    ]);
    transactions.forEach((tx) => {
      if (tx.method) methods.add(tx.method);
    });
    expenses.forEach((exp) => {
      if (exp.paymentMethod) methods.add(exp.paymentMethod);
    });
    return Array.from(methods);
  }, [transactions, expenses]);

  // -------------------------------------------------------------
  // Export Summary Statement (CSV)
  // -------------------------------------------------------------
  const handleExportSummary = () => {
    try {
      const rows: string[][] = [];
      rows.push(["SCHOOLOS FINANCIAL LEDGER - AUDIT SUMMARY STATEMENT"]);
      rows.push(["School:", school?.name || "School"]);
      rows.push(["Generated At:", new Date().toLocaleString("en-IN")]);
      rows.push(["Active Filter Period:", filters.datePreset.toUpperCase()]);
      rows.push(["Active Stream:", filters.stream.toUpperCase()]);
      rows.push(["Active Payment Mode:", filters.paymentMethod]);
      if (truncated) {
        rows.push([
          "Entries Listed:",
          `Latest ${shownCount} of ${matchingCount} (totals cover all ${matchingCount})`,
        ]);
      }
      rows.push([]);

      // Section 1: Executive Position
      rows.push(["EXECUTIVE FINANCIAL POSITION"]);
      rows.push(["Metric", "Value"]);
      rows.push([
        "Total Collections (Inflow)",
        calculatedMetrics.totalInflow.toFixed(2),
      ]);
      rows.push([
        "Collection Receipts Count",
        String(calculatedMetrics.inflowCount),
      ]);
      rows.push([
        "Total Expenses (Outflow)",
        calculatedMetrics.totalOutflow.toFixed(2),
      ]);
      rows.push([
        "Expense Vouchers Count",
        String(calculatedMetrics.outflowCount),
      ]);
      rows.push(["Net Cash Balance", calculatedMetrics.netPosition.toFixed(2)]);
      rows.push([
        "Advance Balance Pool",
        calculatedMetrics.totalAdvanceBalance.toFixed(2),
      ]);
      rows.push([
        "Outstanding Billed Receivables",
        calculatedMetrics.totalReceivables.toFixed(2),
      ]);
      rows.push([
        "Collection Efficiency Rate",
        `${calculatedMetrics.collectionRate}%`,
      ]);
      rows.push([
        "Total Financial Events",
        String(calculatedMetrics.totalTransactionsCount),
      ]);
      rows.push([]);

      // Section 2: Payment Channels
      rows.push(["PAYMENT CHANNELS BREAKDOWN"]);
      rows.push(["Payment Mode", "Inflow (INR)", "Vouchers / Txns"]);
      rows.push([
        "Cash",
        calculatedMetrics.methodStats.cash.inflow.toFixed(2),
        String(calculatedMetrics.methodStats.cash.count),
      ]);
      rows.push([
        "UPI",
        calculatedMetrics.methodStats.upi.inflow.toFixed(2),
        String(calculatedMetrics.methodStats.upi.count),
      ]);
      rows.push([
        "Bank Transfer / Wire",
        calculatedMetrics.methodStats.bankTransfer.inflow.toFixed(2),
        String(calculatedMetrics.methodStats.bankTransfer.count),
      ]);
      rows.push([
        "Cheques / Drafts",
        calculatedMetrics.methodStats.cheque.inflow.toFixed(2),
        String(calculatedMetrics.methodStats.cheque.count),
      ]);
      rows.push([
        "Debit / Credit Cards",
        calculatedMetrics.methodStats.card.inflow.toFixed(2),
        String(calculatedMetrics.methodStats.card.count),
      ]);
      rows.push([]);

      // Section 3: Fee Components
      rows.push(["FEE COMPONENT DISTRIBUTION"]);
      rows.push(["Component Name", "Amount (INR)", "Share (%)"]);
      calculatedMetrics.componentDistribution.forEach((c) => {
        rows.push([c.name, c.amount.toFixed(2), `${c.percentage}%`]);
      });
      rows.push([]);

      // Section 4: Expense Categories
      rows.push(["EXPENSE CATEGORIES BREAKDOWN"]);
      rows.push(["Category Name", "Amount (INR)", "Share (%)"]);
      calculatedMetrics.categoryDistribution.forEach((c) => {
        rows.push([c.name, c.amount.toFixed(2), `${c.percentage}%`]);
      });
      rows.push([]);

      // Section 5: Granular Transaction & Expense Logs
      rows.push(["TRANSACTION & EXPENSE AUDIT LOGS"]);
      rows.push([
        "Date",
        "Stream Type",
        "Receipt / Voucher Ref",
        "Particulars",
        "Category / Class",
        "Payment Mode",
        "Amount (INR)",
      ]);

      transactions.filter(isCollection).forEach((tx) => {
        rows.push([
          new Date(tx.date || tx.createdAt).toLocaleDateString("en-IN"),
          "INFLOW (Collection)",
          tx.receiptNo || tx.reference || "N/A",
          tx.student?.name || "Student",
          tx.student?.class?.name
            ? `Class ${tx.student.class.name}`
            : "Fee Collection",
          tx.method || "CASH",
          Number(tx.amount || 0).toFixed(2),
        ]);
      });

      expenses.forEach((exp) => {
        rows.push([
          new Date(exp.date || exp.createdAt).toLocaleDateString("en-IN"),
          "OUTFLOW (Expense)",
          exp.referenceNo || "N/A",
          exp.title || "Expense",
          exp.category?.name || "General Expense",
          exp.paymentMethod || "CASH",
          `-${Number(exp.amount || 0).toFixed(2)}`,
        ]);
      });

      rows.push([]);

      // CSV Blob download
      const csvContent =
        "data:text/csv;charset=utf-8," +
        rows
          .map((row) =>
            row
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(","),
          )
          .join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `schoolos-ledger-statement-${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Ledger audit summary exported successfully");
    } catch {
      toast.error("Failed to generate ledger export statement");
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          borderRadius: 10,
          colorBgContainer: isDark ? "#09090b" : "#ffffff",
          colorBgElevated: isDark ? "#18181b" : "#ffffff",
          colorBorder: isDark ? "#27272a" : "#e4e4e7",
          colorBorderSecondary: isDark ? "#27272a" : "#f4f4f5",
          colorText: isDark ? "#f4f4f5" : "#09090b",
          colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
        },
      }}
    >
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Transaction Ledger
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200/50">
                READ-ONLY SOURCE OF TRUTH
              </span>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm mt-1">
              Immutable institutional ledger aggregating student collections,
              operational expenditures, and advance settlements.
            </p>
          </div>

          {/* Action Buttons */}
          <div
            id="tour-ledger-export"
            className="flex items-center gap-2.5 flex-wrap"
          >
            <Button
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportSummary}
              className="text-xs font-semibold border-border shadow-sm flex items-center"
            >
              Export Statement (CSV)
            </Button>
            <Button
              icon={<Printer className="w-4 h-4" />}
              onClick={() => window.print()}
              className="text-xs font-semibold border-border shadow-sm flex items-center"
            >
              Print Report
            </Button>
          </div>
        </div>

        {/* Filters Deck */}
        <div id="tour-ledger-filters">
          <LedgerFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            sessions={academicSessions}
            classes={classes}
            feeComponents={feeComponents}
            expenseCategories={expenseCategories}
            availablePaymentMethods={availablePaymentMethods}
          />
        </div>

        <div
          aria-busy={isPending}
          className={`space-y-6 transition-opacity ${isPending ? "opacity-60" : ""}`}
        >
          {/* Statistics Cards */}
          <div id="tour-ledger-summary">
            <LedgerStatCards metrics={calculatedMetrics} />
          </div>

          {truncated && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <p>
                Showing the latest {shownCount.toLocaleString("en-IN")} of{" "}
                {matchingCount.toLocaleString("en-IN")} entries. The totals
                above include all of them.
                {!canLoadMore && " Narrow the dates to see older entries."}
              </p>
              {canLoadMore && (
                <Button
                  size="small"
                  onClick={handleLoadMore}
                  loading={isPending}
                  className="text-xs font-semibold"
                >
                  Load older entries
                </Button>
              )}
            </div>
          )}

          {/* Transaction & Expense Audit Logs Table */}
          <div id="tour-ledger-table">
            <LedgerTable
              transactions={transactions}
              expenses={expenses}
              advances={advanceLedgers}
              onViewReceipt={handleOpenReceipt}
            />
          </div>
        </div>

        {/* Fee Receipt & Invoice Modal */}
        <FeeReceiptModal
          isOpen={receiptModal.open}
          onClose={() => setReceiptModal({ open: false, data: null })}
          receiptData={receiptModal.data}
        />
      </div>
    </ConfigProvider>
  );
}
