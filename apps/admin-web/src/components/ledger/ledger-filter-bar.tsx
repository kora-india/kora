"use client";

import React from "react";
import { Search, RotateCcw, Calendar, Filter, X } from "lucide-react";
import { DatePicker, Select } from "antd";
import type { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

export type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type StreamFilter = "all" | "inflow" | "outflow" | "advance";

export interface LedgerFilterState {
  search: string;
  datePreset: DatePreset;
  customDateRange: [Dayjs | null, Dayjs | null] | null;
  stream: StreamFilter;
  paymentMethod: string;
  sessionId: string;
  classId: string;
  componentOrCategory: string;
}

interface LedgerFilterBarProps {
  filters: LedgerFilterState;
  onFilterChange: <K extends keyof LedgerFilterState>(
    key: K,
    value: LedgerFilterState[K],
  ) => void;
  onResetFilters: () => void;
  sessions: { id: string; name: string }[];
  classes: { id: string; name: string; grade: number }[];
  feeComponents: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
  availablePaymentMethods: string[];
}

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_year", label: "This Year" },
];

const STREAM_OPTIONS: {
  id: StreamFilter;
  label: string;
  badgeColor: string;
}[] = [
  {
    id: "all",
    label: "All Streams",
    badgeColor: "bg-muted text-muted-foreground",
  },
  {
    id: "inflow",
    label: "Collections (Inflow)",
    badgeColor:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  {
    id: "outflow",
    label: "Expenses (Outflow)",
    badgeColor:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  },
  {
    id: "advance",
    label: "Advance Adjustments",
    badgeColor:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
];

export function LedgerFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  sessions,
  classes,
  feeComponents,
  expenseCategories,
  availablePaymentMethods,
}: Readonly<LedgerFilterBarProps>) {
  const isCustomDate = filters.datePreset === "custom";

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.datePreset !== "all" ||
    filters.stream !== "all" ||
    filters.paymentMethod !== "all" ||
    filters.sessionId !== "all" ||
    filters.classId !== "all" ||
    filters.componentOrCategory !== "all" ||
    filters.customDateRange !== null;

  return (
    <div className="bg-card border rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
      {/* Top Controls: Search and Stream Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Stream Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl overflow-x-auto">
          {STREAM_OPTIONS.map((opt) => {
            const isSelected = filters.stream === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFilterChange("stream", opt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Search Input & Reset */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search receipt, UTR, student, roll..."
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFilterChange("search", "")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-xl transition-colors border cursor-pointer whitespace-nowrap"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Presets Row */}
      <div className="flex items-center gap-1.5 flex-wrap border-t pt-3">
        <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-violet-500" />
          Period:
        </span>
        {DATE_PRESETS.map((dp) => {
          const isSelected = filters.datePreset === dp.id;
          return (
            <button
              key={dp.id}
              type="button"
              onClick={() => {
                onFilterChange("datePreset", dp.id);
                if (dp.id !== "custom") {
                  onFilterChange("customDateRange", null);
                }
              }}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                isSelected
                  ? "bg-violet-600 text-white shadow-sm font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
              }`}
            >
              {dp.label}
            </button>
          );
        })}

        {/* Custom Range Trigger */}
        <button
          type="button"
          onClick={() => onFilterChange("datePreset", "custom")}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
            isCustomDate
              ? "bg-violet-600 text-white shadow-sm font-semibold"
              : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
          }`}
        >
          Custom Range
        </button>

        {isCustomDate && (
          <div className="ml-1">
            <RangePicker
              size="small"
              value={filters.customDateRange}
              onChange={(dates) =>
                onFilterChange(
                  "customDateRange",
                  dates as [Dayjs | null, Dayjs | null] | null,
                )
              }
              className="rounded-lg text-xs"
            />
          </div>
        )}
      </div>

      {/* Dropdown Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        {/* Payment Method Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Payment Mode
          </label>
          <Select
            value={filters.paymentMethod}
            onChange={(val) => onFilterChange("paymentMethod", val)}
            className="w-full text-xs"
            size="middle"
            options={[
              { value: "all", label: "All Payment Modes" },
              ...availablePaymentMethods.map((m) => ({
                value: m,
                label: m.replace(/_/g, " "),
              })),
            ]}
          />
        </div>

        {/* Academic Session Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Academic Session
          </label>
          <Select
            value={filters.sessionId}
            onChange={(val) => onFilterChange("sessionId", val)}
            className="w-full text-xs"
            size="middle"
            options={[
              { value: "all", label: "All Academic Sessions" },
              ...sessions.map((s) => ({
                value: s.id,
                label: s.name,
              })),
            ]}
          />
        </div>

        {/* Class / Grade Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Class / Grade
          </label>
          <Select
            value={filters.classId}
            onChange={(val) => onFilterChange("classId", val)}
            className="w-full text-xs"
            size="middle"
            options={[
              { value: "all", label: "All Classes & Grades" },
              ...classes.map((c) => ({
                value: c.id,
                label: c.name,
              })),
            ]}
          />
        </div>

        {/* Fee Component or Expense Category */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Component / Category
          </label>
          <Select
            value={filters.componentOrCategory}
            onChange={(val) => onFilterChange("componentOrCategory", val)}
            className="w-full text-xs"
            size="middle"
            options={[
              { value: "all", label: "All Components & Categories" },
              ...(feeComponents.length > 0
                ? [
                    {
                      label: "Fee Components",
                      options: feeComponents.map((fc) => ({
                        value: `comp_${fc.id}`,
                        label: fc.name,
                      })),
                    },
                  ]
                : []),
              ...(expenseCategories.length > 0
                ? [
                    {
                      label: "Expense Categories",
                      options: expenseCategories.map((ec) => ({
                        value: `cat_${ec.id}`,
                        label: ec.name,
                      })),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Filter className="w-3 h-3 text-violet-500" /> Active Filters:
          </span>

          {filters.stream !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-medium border border-violet-200/60">
              Stream: {filters.stream.toUpperCase()}
              <button
                type="button"
                onClick={() => onFilterChange("stream", "all")}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filters.datePreset !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium border border-blue-200/60">
              Period: {filters.datePreset.replace(/_/g, " ").toUpperCase()}
              <button
                type="button"
                onClick={() => {
                  onFilterChange("datePreset", "all");
                  onFilterChange("customDateRange", null);
                }}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filters.paymentMethod !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium border border-amber-200/60">
              Mode: {filters.paymentMethod.replace(/_/g, " ")}
              <button
                type="button"
                onClick={() => onFilterChange("paymentMethod", "all")}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filters.classId !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200/60">
              Class:{" "}
              {classes.find((c) => c.id === filters.classId)?.name ||
                filters.classId}
              <button
                type="button"
                onClick={() => onFilterChange("classId", "all")}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filters.sessionId !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-foreground font-medium border">
              Session:{" "}
              {sessions.find((s) => s.id === filters.sessionId)?.name ||
                filters.sessionId}
              <button
                type="button"
                onClick={() => onFilterChange("sessionId", "all")}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filters.componentOrCategory !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium border border-purple-200/60">
              {filters.componentOrCategory.startsWith("comp_")
                ? "Fee Component"
                : "Category"}
              <button
                type="button"
                onClick={() => onFilterChange("componentOrCategory", "all")}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-foreground font-medium border">
              &ldquo;{filters.search}&rdquo;
              <button
                type="button"
                onClick={() => onFilterChange("search", "")}
                className="hover:text-red-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
