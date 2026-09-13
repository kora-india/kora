"use client";

import React, { useState, useMemo } from "react";
import { Download, FileSpreadsheet, Scale, Printer } from "lucide-react";
import { Button, ConfigProvider, theme as antTheme } from "antd";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { formatCurrency } from "@schoolos/utils";
import {
  LedgerFilterBar,
  type LedgerFilterState,
  type DatePreset,
  type StreamFilter,
} from "./ledger-filter-bar";
import { LedgerStatCards, type LedgerMetrics } from "./ledger-stat-cards";
import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
} from "date-fns";

interface Props {
  school: { name?: string; currency?: string } | null;
  transactions: any[];
  advanceLedgers: any[];
  expenses: any[];
  feeChargeItems: any[];
  academicSessions: any[];
  classes: any[];
  feeComponents: any[];
  expenseCategories: any[];
  userRole: string;
}

export function LedgerContent({
  school,
  transactions,
  advanceLedgers,
  expenses,
  feeChargeItems,
  academicSessions,
  classes,
  feeComponents,
  expenseCategories,
  userRole,
}: Readonly<Props>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Filter State
  const [filters, setFilters] = useState<LedgerFilterState>({
    search: "",
    datePreset: "all",
    customDateRange: null,
    stream: "all",
    paymentMethod: "all",
    sessionId: "all",
    classId: "all",
    componentOrCategory: "all",
  });

  const handleFilterChange = <K extends keyof LedgerFilterState>(
    key: K,
    value: LedgerFilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      datePreset: "all",
      customDateRange: null,
      stream: "all",
      paymentMethod: "all",
      sessionId: "all",
      classId: "all",
      componentOrCategory: "all",
    });
  };

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

  // Helper to test if a date satisfies the active date preset / custom range
  const matchesDateFilter = (
    dateInput: string | Date | null | undefined,
  ): boolean => {
    if (!dateInput) return false;
    if (filters.datePreset === "all" && !filters.customDateRange) return true;

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return false;

    // Custom range check
    if (filters.datePreset === "custom" && filters.customDateRange) {
      const [start, end] = filters.customDateRange;
      if (!start && !end) return true;
      const startDate = start ? start.startOf("day").toDate() : new Date(0);
      const endDate = end
        ? end.endOf("day").toDate()
        : new Date(8640000000000000);
      return date >= startDate && date <= endDate;
    }

    switch (filters.datePreset) {
      case "today":
        return isToday(date);
      case "yesterday":
        return isYesterday(date);
      case "this_week":
        return isThisWeek(date, { weekStartsOn: 1 });
      case "this_month":
        return isThisMonth(date);
      case "last_month": {
        const lastMonthDate = subMonths(new Date(), 1);
        return isWithinInterval(date, {
          start: startOfMonth(lastMonthDate),
          end: endOfMonth(lastMonthDate),
        });
      }
      case "this_year": {
        const now = new Date();
        return isWithinInterval(date, {
          start: startOfYear(now),
          end: endOfYear(now),
        });
      }
      default:
        return true;
    }
  };

  // -------------------------------------------------------------
  // Filtered Datasets
  // -------------------------------------------------------------

  // 1. Filtered Transactions (Inflows)
  const filteredTransactions = useMemo(() => {
    if (filters.stream === "outflow" || filters.stream === "advance") {
      return [];
    }

    return transactions.filter((tx) => {
      // Date filter
      if (!matchesDateFilter(tx.date || tx.createdAt)) return false;

      // Payment method
      if (
        filters.paymentMethod !== "all" &&
        tx.method?.toUpperCase() !== filters.paymentMethod.toUpperCase()
      ) {
        return false;
      }

      // Class filter
      if (filters.classId !== "all") {
        const studentClassId = tx.student?.classId || tx.student?.class?.id;
        if (studentClassId !== filters.classId) return false;
      }

      // Session filter
      if (filters.sessionId !== "all") {
        const hasSessionAlloc = tx.allocations?.some(
          (a: any) => a.chargeItem?.charge?.sessionId === filters.sessionId,
        );
        if (!hasSessionAlloc) return false;
      }

      // Component filter
      if (filters.componentOrCategory.startsWith("comp_")) {
        const compId = filters.componentOrCategory.replace("comp_", "");
        const hasCompAlloc = tx.allocations?.some(
          (a: any) => a.chargeItem?.componentId === compId,
        );
        if (!hasCompAlloc) return false;
      } else if (filters.componentOrCategory.startsWith("cat_")) {
        // Expense category selected, transactions don't match
        return false;
      }

      // Search term
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const receiptMatch = tx.receiptNo?.toLowerCase().includes(q);
        const studentMatch = tx.student?.name?.toLowerCase().includes(q);
        const rollMatch = tx.student?.rollNumber?.toLowerCase().includes(q);
        const refMatch = tx.reference?.toLowerCase().includes(q);
        const remarksMatch = tx.remarks?.toLowerCase().includes(q);
        if (
          !receiptMatch &&
          !studentMatch &&
          !rollMatch &&
          !refMatch &&
          !remarksMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  // 2. Filtered Expenses (Outflows)
  const filteredExpenses = useMemo(() => {
    if (filters.stream === "inflow" || filters.stream === "advance") {
      return [];
    }

    return expenses.filter((exp) => {
      // Date filter
      if (!matchesDateFilter(exp.date)) return false;

      // Payment method
      if (
        filters.paymentMethod !== "all" &&
        exp.paymentMethod?.toUpperCase() !== filters.paymentMethod.toUpperCase()
      ) {
        return false;
      }

      // Class filter (expenses are school-wide, so if a class is chosen, exclude expenses)
      if (filters.classId !== "all") {
        return false;
      }

      // Category / Component filter
      if (filters.componentOrCategory.startsWith("cat_")) {
        const catId = filters.componentOrCategory.replace("cat_", "");
        if (exp.category?.id !== catId && exp.categoryId !== catId) {
          return false;
        }
      } else if (filters.componentOrCategory.startsWith("comp_")) {
        // Fee component selected, expenses don't match
        return false;
      }

      // Search term
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const titleMatch = exp.title?.toLowerCase().includes(q);
        const descMatch = exp.description?.toLowerCase().includes(q);
        const refMatch = exp.referenceNo?.toLowerCase().includes(q);
        const catMatch = exp.category?.name?.toLowerCase().includes(q);
        const userMatch = exp.recordedBy?.name?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !refMatch && !catMatch && !userMatch) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, filters]);

  // 3. Filtered Advance Ledger Entries
  const filteredAdvances = useMemo(() => {
    if (filters.stream === "outflow") {
      return [];
    }

    return advanceLedgers.filter((adv) => {
      // Date filter
      if (!matchesDateFilter(adv.createdAt)) return false;

      // Class filter
      if (filters.classId !== "all") {
        const studentClassId = adv.student?.classId || adv.student?.class?.id;
        if (studentClassId !== filters.classId) return false;
      }

      // Component filter
      if (filters.componentOrCategory.startsWith("comp_")) {
        const compId = filters.componentOrCategory.replace("comp_", "");
        if (adv.componentId && adv.componentId !== compId) return false;
      } else if (filters.componentOrCategory.startsWith("cat_")) {
        return false;
      }

      // Search term
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const studentMatch = adv.student?.name?.toLowerCase().includes(q);
        const rollMatch = adv.student?.rollNumber?.toLowerCase().includes(q);
        const descMatch = adv.description?.toLowerCase().includes(q);
        if (!studentMatch && !rollMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [advanceLedgers, filters]);

  // 4. Filtered Fee Charge Items (Receivables)
  const filteredChargeItems = useMemo(() => {
    return feeChargeItems.filter((item) => {
      // Date filter based on charge due date
      if (!matchesDateFilter(item.charge?.dueDate)) return false;

      // Session filter
      if (
        filters.sessionId !== "all" &&
        item.charge?.sessionId !== filters.sessionId
      ) {
        return false;
      }

      // Component filter
      if (filters.componentOrCategory.startsWith("comp_")) {
        const compId = filters.componentOrCategory.replace("comp_", "");
        if (item.component?.id !== compId && item.componentId !== compId) {
          return false;
        }
      } else if (filters.componentOrCategory.startsWith("cat_")) {
        return false;
      }

      return true;
    });
  }, [feeChargeItems, filters]);

  // -------------------------------------------------------------
  // Comprehensive Metrics Calculation
  // -------------------------------------------------------------
  const calculatedMetrics: LedgerMetrics = useMemo(() => {
    // 1. Inflows
    const totalInflow = filteredTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount || 0),
      0,
    );
    const inflowCount = filteredTransactions.length;
    const avgInflow = inflowCount > 0 ? totalInflow / inflowCount : 0;

    // 2. Outflows
    const totalOutflow = filteredExpenses.reduce(
      (sum, exp) => sum + Number(exp.amount || 0),
      0,
    );
    const outflowCount = filteredExpenses.length;
    const avgOutflow = outflowCount > 0 ? totalOutflow / outflowCount : 0;

    // 3. Net Position
    const netPosition = totalInflow - totalOutflow;

    // 4. Advance Ledger Balances
    const totalAdvanceBalance = filteredAdvances.reduce(
      (sum, adv) => sum + Number(adv.amount || 0),
      0,
    );
    const advanceEntriesCount = filteredAdvances.length;

    // 5. Billed Fees & Receivables
    let totalBilledFees = 0;
    let totalPaidFromCharges = 0;
    filteredChargeItems.forEach((item) => {
      const amt = Number(item.amount || 0);
      const paid = Number(item.paidAmount || 0);
      totalBilledFees += amt;
      totalPaidFromCharges += paid;
    });

    const totalReceivables = Math.max(
      0,
      totalBilledFees - totalPaidFromCharges,
    );
    const collectionRate =
      totalBilledFees > 0
        ? Math.round((totalPaidFromCharges / totalBilledFees) * 1000) / 10
        : 0;

    // 6. Total Transactions Count & Active Velocity
    const totalTransactionsCount =
      inflowCount + outflowCount + advanceEntriesCount;
    const activePeriodDays =
      filters.datePreset === "today" || filters.datePreset === "yesterday"
        ? 1
        : filters.datePreset === "this_week"
          ? 7
          : filters.datePreset === "this_month" ||
              filters.datePreset === "last_month"
            ? 30
            : filters.datePreset === "this_year"
              ? 365
              : 30;

    // 7. Payment Methods Breakdown
    const methodStats = {
      cash: { inflow: 0, outflow: 0, net: 0, count: 0 },
      upi: { inflow: 0, count: 0 },
      bankTransfer: { inflow: 0, count: 0 },
      cheque: { inflow: 0, count: 0 },
      card: { inflow: 0, count: 0 },
      other: { inflow: 0, count: 0 },
    };

    filteredTransactions.forEach((tx) => {
      const m = (tx.method || "OTHER").toUpperCase();
      const amt = Number(tx.amount || 0);

      if (m === "CASH") {
        methodStats.cash.inflow += amt;
        methodStats.cash.count++;
      } else if (m === "UPI") {
        methodStats.upi.inflow += amt;
        methodStats.upi.count++;
      } else if (["BANK_TRANSFER", "NEFT", "RTGS", "IMPS"].includes(m)) {
        methodStats.bankTransfer.inflow += amt;
        methodStats.bankTransfer.count++;
      } else if (m === "CHEQUE" || m === "DD") {
        methodStats.cheque.inflow += amt;
        methodStats.cheque.count++;
      } else if (["CREDIT_CARD", "DEBIT_CARD", "CARD"].includes(m)) {
        methodStats.card.inflow += amt;
        methodStats.card.count++;
      } else {
        methodStats.other.inflow += amt;
        methodStats.other.count++;
      }
    });

    filteredExpenses.forEach((exp) => {
      const m = (exp.paymentMethod || "OTHER").toUpperCase();
      const amt = Number(exp.amount || 0);
      if (m === "CASH") {
        methodStats.cash.outflow += amt;
        methodStats.cash.count++;
      }
    });

    methodStats.cash.net = methodStats.cash.inflow - methodStats.cash.outflow;

    // 8. Fee Component Distribution
    const compMap = new Map<
      string,
      {
        id: string;
        name: string;
        category?: string;
        amount: number;
        count: number;
      }
    >();

    filteredTransactions.forEach((tx) => {
      tx.allocations?.forEach((alloc: any) => {
        const comp = alloc.chargeItem?.component;
        if (!comp) return;
        const compId = comp.id;
        const amt = Number(alloc.amount || 0);
        const existing = compMap.get(compId) || {
          id: compId,
          name: comp.name,
          category: comp.category,
          amount: 0,
          count: 0,
        };
        existing.amount += amt;
        existing.count++;
        compMap.set(compId, existing);
      });
    });

    const totalAllocatedAmount = Array.from(compMap.values()).reduce(
      (sum, c) => sum + c.amount,
      0,
    );

    const componentDistribution = Array.from(compMap.values())
      .map((c) => ({
        ...c,
        percentage:
          totalAllocatedAmount > 0
            ? Math.round((c.amount / totalAllocatedAmount) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 9. Expense Category Distribution
    const catMap = new Map<
      string,
      { id: string; name: string; amount: number; count: number }
    >();

    filteredExpenses.forEach((exp) => {
      const cat = exp.category;
      const catId = cat?.id || "uncategorized";
      const catName = cat?.name || "General Operational";
      const amt = Number(exp.amount || 0);

      const existing = catMap.get(catId) || {
        id: catId,
        name: catName,
        amount: 0,
        count: 0,
      };
      existing.amount += amt;
      existing.count++;
      catMap.set(catId, existing);
    });

    const categoryDistribution = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        percentage:
          totalOutflow > 0
            ? Math.round((c.amount / totalOutflow) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 10. Class Level Breakdown
    const classMap = new Map<
      string,
      {
        classId: string;
        className: string;
        grade: number;
        collectedAmount: number;
        receivables: number;
        transactionCount: number;
      }
    >();

    classes.forEach((c) => {
      classMap.set(c.id, {
        classId: c.id,
        className: c.name,
        grade: c.grade ?? 0,
        collectedAmount: 0,
        receivables: 0,
        transactionCount: 0,
      });
    });

    filteredTransactions.forEach((tx) => {
      const cId = tx.student?.classId || tx.student?.class?.id;
      if (cId && classMap.has(cId)) {
        const item = classMap.get(cId)!;
        item.collectedAmount += Number(tx.amount || 0);
        item.transactionCount++;
      }
    });

    const classBreakdown = Array.from(classMap.values())
      .map((item) => {
        const totalBilled = item.collectedAmount + item.receivables;
        return {
          ...item,
          recoveryRate:
            totalBilled > 0
              ? Math.round((item.collectedAmount / totalBilled) * 100)
              : item.collectedAmount > 0
                ? 100
                : 0,
        };
      })
      .sort((a, b) => b.collectedAmount - a.collectedAmount);

    return {
      totalInflow,
      inflowCount,
      avgInflow,
      totalOutflow,
      outflowCount,
      avgOutflow,
      netPosition,
      totalAdvanceBalance,
      advanceEntriesCount,
      totalReceivables,
      totalBilledFees,
      collectionRate,
      totalTransactionsCount,
      activePeriodDays,
      methodStats,
      componentDistribution,
      categoryDistribution,
      classBreakdown,
    };
  }, [
    filteredTransactions,
    filteredExpenses,
    filteredAdvances,
    filteredChargeItems,
    classes,
    filters.datePreset,
  ]);

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
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1400px]">
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
          <div className="flex items-center gap-2.5 flex-wrap">
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

        {/* Statistics Cards (The Core of the Page) */}
        <LedgerStatCards metrics={calculatedMetrics} />
      </div>
    </ConfigProvider>
  );
}
