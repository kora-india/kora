"use client";

import React from "react";
import { Search, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Popover, Select, type SelectProps } from "antd";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-methods";
import type { LedgerQuery, LedgerStream } from "@/lib/reports/ledger-query";
import { PeriodFilter } from "./period-filter";

const TYPES: { id: LedgerStream; label: string }[] = [
  { id: "all", label: "All" },
  { id: "inflow", label: "Collections" },
  { id: "outflow", label: "Expenses" },
  { id: "advance", label: "Advances" },
];

type Option = { id: string; name: string };

interface LedgerFilterBarProps {
  filters: LedgerQuery;
  onChange: (patch: Partial<LedgerQuery>) => void;
  onReset: () => void;
  sessions: Option[];
  classes: Option[];
  feeComponents: Option[];
  expenseCategories: Option[];
}

export function LedgerFilterBar({
  filters,
  onChange,
  onReset,
  sessions,
  classes,
  feeComponents,
  expenseCategories,
}: Readonly<LedgerFilterBarProps>) {
  const moreCount = [filters.sessionId, filters.classId, filters.item].filter(
    (v) => v !== "all",
  ).length;
  const hasFilters =
    moreCount > 0 ||
    filters.q.trim() !== "" ||
    filters.period !== "all" ||
    filters.stream !== "all" ||
    filters.method !== "all";

  const more = (
    <div className="w-64 space-y-3">
      <MoreSelect
        label="Academic session"
        value={filters.sessionId}
        onChange={(sessionId) => onChange({ sessionId })}
        options={[
          { value: "all", label: "All sessions" },
          ...sessions.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <MoreSelect
        label="Class"
        value={filters.classId}
        onChange={(classId) => onChange({ classId })}
        options={[
          { value: "all", label: "All classes" },
          ...classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <MoreSelect
        label="Fee head or expense category"
        value={filters.item}
        onChange={(item) => onChange({ item })}
        options={[
          { value: "all", label: "All" },
          ...(feeComponents.length > 0
            ? [
                {
                  label: "Fee heads",
                  options: feeComponents.map((c) => ({
                    value: `comp_${c.id}`,
                    label: c.name,
                  })),
                },
              ]
            : []),
          ...(expenseCategories.length > 0
            ? [
                {
                  label: "Expense categories",
                  options: expenseCategories.map((c) => ({
                    value: `cat_${c.id}`,
                    label: c.name,
                  })),
                },
              ]
            : []),
        ]}
      />
    </div>
  );

  return (
    <div className="flex flex-col xl:flex-row xl:items-center gap-3 print:hidden">
      <div
        role="tablist"
        aria-label="Type"
        className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit overflow-x-auto"
      >
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filters.stream === t.id}
            onClick={() => onChange({ stream: t.id })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              filters.stream === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 flex-1">
        <PeriodFilter value={filters} onChange={(period) => onChange(period)} />
        <Select
          value={filters.method}
          onChange={(method) => onChange({ method })}
          className="w-full sm:w-40"
          aria-label="Payment mode"
          options={[
            { value: "all", label: "All modes" },
            ...PAYMENT_METHOD_OPTIONS.map((m) => ({
              value: m.value,
              label: m.label,
            })),
          ]}
        />
        <div className="relative w-full sm:flex-1 sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search receipt, student, reference…"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            className="w-full h-8 pl-9 pr-8 text-sm rounded-[10px] border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
          {filters.q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange({ q: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover content={more} trigger="click" placement="bottomRight">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-[10px] border bg-background hover:bg-muted transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              More filters
              {moreCount > 0 && (
                <span className="ml-0.5 rounded-full bg-violet-600 text-white px-1.5 text-[10px] font-bold">
                  {moreCount}
                </span>
              )}
            </button>
          </Popover>
          {hasFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-[10px] hover:bg-muted transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MoreSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectProps["options"];
}>) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </span>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        className="w-full"
        showSearch
        optionFilterProp="label"
      />
    </label>
  );
}
