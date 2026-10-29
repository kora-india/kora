"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button } from "antd";
import { toast } from "sonner";
import { LedgerShell } from "./ledger-shell";
import { LedgerFilterBar } from "./ledger-filter-bar";
import { LedgerStatCards } from "./ledger-stat-cards";
import { LedgerTable } from "./ledger-table";
import { dateTimeParts, personLabel } from "./format";
import { FeeReceiptModal } from "@/components/fees/fee-receipt-modal";
import {
  getFeeReceiptDetails,
  type FeeReceiptData,
} from "@/lib/actions/fee-allocator";
import { exportLedger } from "@/lib/actions/ledger";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  DEFAULT_LEDGER_QUERY,
  LEDGER_PAGE_SIZE,
  ledgerQueryToSearch,
  type LedgerQuery,
} from "@/lib/reports/ledger-query";
import type {
  LedgerMetrics,
  LedgerRow,
  LedgerRowKind,
} from "@/lib/reports/ledger";

type Option = { id: string; name: string };

interface Props {
  schoolName: string;
  /** The filters the server applied (from the URL). */
  query: LedgerQuery;
  /** Totals over every matching row. */
  metrics: LedgerMetrics;
  /** This page of the list. */
  rows: LedgerRow[];
  /** Matching rows in all pages. */
  total: number;
  timeZone: string;
  showActivityTab: boolean;
  sessions: Option[];
  classes: Option[];
  feeComponents: Option[];
  expenseCategories: Option[];
}

const KIND_LABELS: Record<LedgerRowKind, string> = {
  collection: "Collection",
  expense: "Expense",
  settlement: "Advance used",
  advance: "Advance credit",
};

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function LedgerContent({
  schoolName,
  query,
  metrics,
  rows,
  total,
  timeZone,
  showActivityTab,
  sessions,
  classes,
  feeComponents,
  expenseCategories,
}: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [receipt, setReceipt] = useState<FeeReceiptData | null>(null);

  // The server filters: each change updates the URL and the page re-renders
  // with matching rows and totals. The bar can fire two changes in a row, so
  // each one builds on the latest filters, not on this render's.
  const [filters, setFiltersState] = useState(query);
  const latest = useRef(filters);
  const setFilters = (next: LedgerQuery) => {
    latest.current = next;
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
      setFilters(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const handleChange = (patch: Partial<LedgerQuery>) => {
    // A new filter starts again from the first page.
    const next = { ...latest.current, ...patch, page: 1 };
    setFilters(next);
    clearTimeout(searchTimer.current);
    const go = () => navigate(next);
    // Typing waits for a pause; picking custom dates waits for a date.
    if ("q" in patch) searchTimer.current = setTimeout(go, 400);
    else if (!(next.period === "custom" && !next.from && !next.to)) go();
  };

  const handleReset = () => {
    clearTimeout(searchTimer.current);
    setFilters(DEFAULT_LEDGER_QUERY);
    navigate(DEFAULT_LEDGER_QUERY);
  };

  const handlePage = (page: number) => {
    setFilters({ ...latest.current, page });
    navigate({ ...query, page });
  };

  const handleOpenReceipt = async (receiptNo: string) => {
    try {
      const res = await getFeeReceiptDetails(receiptNo);
      if (res.success && res.data) setReceipt(res.data);
      else toast.error(res.error || "Failed to load receipt");
    } catch {
      toast.error("Failed to fetch receipt details");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = Object.fromEntries(
        new URLSearchParams(ledgerQueryToSearch(query)),
      );
      const res = await exportLedger(params);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const header = [
        "Date",
        "Time",
        "Type",
        "Receipt / Ref",
        "Particulars",
        "Details",
        "Mode",
        "Amount (INR)",
        "Done by",
      ];
      const lines = res.rows.map((r) => {
        const when = dateTimeParts(r.date, timeZone);
        const signed = r.kind === "expense" ? -r.amount : r.amount;
        return [
          when.date,
          when.time,
          KIND_LABELS[r.kind],
          [r.receiptNo, r.reference].filter(Boolean).join(" / "),
          r.particulars,
          r.detail,
          r.method ? paymentMethodLabel(r.method) : "",
          signed.toFixed(2),
          personLabel(r.doneBy),
        ];
      });
      const csv = [header, ...lines]
        .map((line) => line.map(csvCell).join(","))
        .join("\n");
      // The BOM makes Excel read names in other scripts correctly.
      const blob = new Blob([`﻿${csv}`], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${schoolName.replace(/[^\w]+/g, "-").toLowerCase()}-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success(
        res.total > res.rows.length
          ? `Downloaded the newest ${res.rows.length.toLocaleString("en-IN")} of ${res.total.toLocaleString("en-IN")} entries. Narrow the dates for the rest.`
          : `Downloaded ${res.rows.length.toLocaleString("en-IN")} entries`,
      );
    } catch {
      toast.error("Couldn't export the ledger");
    } finally {
      setExporting(false);
    }
  };

  return (
    <LedgerShell
      tab="transactions"
      showTabs={showActivityTab}
      actions={
        <div
          id="tour-ledger-export"
          className="flex items-center gap-2 print:hidden"
        >
          <Button
            icon={<Download className="w-4 h-4" />}
            onClick={handleExport}
            loading={exporting}
            className="flex items-center"
          >
            Export CSV
          </Button>
          <Button
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
            className="flex items-center"
          >
            Print
          </Button>
        </div>
      }
    >
      <div id="tour-ledger-filters">
        <LedgerFilterBar
          filters={filters}
          onChange={handleChange}
          onReset={handleReset}
          sessions={sessions}
          classes={classes}
          feeComponents={feeComponents}
          expenseCategories={expenseCategories}
        />
      </div>

      <div
        aria-busy={isPending}
        className={`space-y-5 transition-opacity ${isPending ? "opacity-60" : ""}`}
      >
        <div id="tour-ledger-summary">
          <LedgerStatCards metrics={metrics} />
        </div>

        <div id="tour-ledger-table">
          <LedgerTable
            rows={rows}
            page={query.page}
            pageSize={LEDGER_PAGE_SIZE}
            total={total}
            timeZone={timeZone}
            onPage={handlePage}
            onViewReceipt={handleOpenReceipt}
          />
        </div>
      </div>

      <FeeReceiptModal
        isOpen={receipt !== null}
        onClose={() => setReceipt(null)}
        receiptData={receipt}
      />
    </LedgerShell>
  );
}
