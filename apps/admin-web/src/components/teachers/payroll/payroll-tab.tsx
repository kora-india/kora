"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  Receipt,
  Search,
  Wallet,
  BadgeCheck,
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import { selectCls } from "@/components/ui/form-field";
import {
  EDITABLE_STATUSES,
  PAYABLE_STATUSES,
  SLIP_STATUSES,
  STATUS_META,
  formatPayrollMonth,
  methodLabel,
  monthKey,
  monthName,
  parseMonthKey,
  recentMonths,
  successfulPayout,
  type PayoutRecord,
  type SalarySlipRecord,
} from "@/lib/payroll";
import { formatDate } from "../profile/types";
import { SlipStatusBadge } from "./ui";
import { PayoutStatusBadge } from "./payout-details-dialog";

interface Props {
  slips: SalarySlipRecord[];
  monthlySalary: number | null;
  payrollReady: boolean;
  canGenerate: boolean;
  selectedMonth: string;
  onSelectedMonthChange: (key: string) => void;
  onGenerate: (monthKey: string) => void;
  onView: (slip: SalarySlipRecord) => void;
  onDownload: (slip: SalarySlipRecord) => void;
  onPayout: (slip: SalarySlipRecord) => void;
  onPayoutDetails: (slip: SalarySlipRecord, payout: PayoutRecord) => void;
}

function SummaryCard({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: string; tone?: "neg" | "brand" }>) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums mt-1 ${
          tone === "neg"
            ? "text-red-600 dark:text-red-400"
            : tone === "brand"
              ? "text-violet-700 dark:text-violet-300"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: Readonly<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

export function PayrollTab({
  slips,
  monthlySalary,
  payrollReady,
  canGenerate,
  selectedMonth,
  onSelectedMonthChange,
  onGenerate,
  onView,
  onDownload,
  onPayout,
  onPayoutDetails,
}: Readonly<Props>) {
  const [yearFilter, setYearFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const monthOptions = useMemo(() => recentMonths(24), []);
  const { year, month } = parseMonthKey(selectedMonth);
  const current = slips.find((s) => s.year === year && s.month === month);
  const years = useMemo(
    () => [...new Set(slips.map((s) => s.year))].sort((a, b) => b - a),
    [slips],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slips.filter((s) => {
      if (yearFilter !== "ALL" && s.year !== Number(yearFilter)) return false;
      if (monthFilter !== "ALL" && s.month !== Number(monthFilter))
        return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.slipNumber.toLowerCase().includes(q) ||
        formatPayrollMonth(s.year, s.month).toLowerCase().includes(q) ||
        s.payouts.some((p) => p.transactionId.toLowerCase().includes(q))
      );
    });
  }, [slips, yearFilter, monthFilter, statusFilter, query]);

  const payouts = useMemo(
    () =>
      slips
        .flatMap((s) => s.payouts.map((p) => ({ slip: s, payout: p })))
        .sort((a, b) => b.payout.createdAt.localeCompare(a.payout.createdAt)),
    [slips],
  );

  const filtersActive =
    yearFilter !== "ALL" ||
    monthFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    query !== "";

  if (!payrollReady) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Payroll isn't set up yet
          </p>
          <p className="text-amber-800/80 dark:text-amber-200/80 mt-1">
            The payroll tables haven't been created in this database. Apply the
            latest schema (<code>pnpm db:push</code>) to start generating salary
            slips.
          </p>
        </div>
      </div>
    );
  }

  const rowActions = (s: SalarySlipRecord) => {
    const paid = successfulPayout(s);
    return (
      <>
        <IconButton label="View salary slip" onClick={() => onView(s)}>
          <Eye className="w-4 h-4" />
        </IconButton>
        <IconButton label="Download salary slip" onClick={() => onDownload(s)}>
          <Download className="w-4 h-4" />
        </IconButton>
        {paid ? (
          <IconButton
            label="View payout details"
            onClick={() => onPayoutDetails(s, paid)}
          >
            <BadgeCheck className="w-4 h-4" />
          </IconButton>
        ) : PAYABLE_STATUSES.includes(s.status) ? (
          <IconButton label="Process payout" onClick={() => onPayout(s)}>
            <Wallet className="w-4 h-4" />
          </IconButton>
        ) : null}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Selected month */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Payroll</h2>
            <p className="text-sm text-muted-foreground">
              {formatPayrollMonth(year, month)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="payroll-month"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Change month
            </label>
            <select
              id="payroll-month"
              value={selectedMonth}
              onChange={(e) => onSelectedMonthChange(e.target.value)}
              className={`${selectCls} w-auto min-w-[10rem]`}
            >
              {monthOptions.map((m) => (
                <option
                  key={monthKey(m.year, m.month)}
                  value={monthKey(m.year, m.month)}
                >
                  {formatPayrollMonth(m.year, m.month)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {current ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Gross Salary"
                value={formatCurrency(current.grossSalary)}
              />
              <SummaryCard
                label="Deductions"
                value={formatCurrency(current.totalDeductions)}
                tone="neg"
              />
              <SummaryCard
                label="Net Pay"
                value={formatCurrency(current.netSalary)}
                tone="brand"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Slip #{current.slipNumber}
                </span>
                <SlipStatusBadge status={current.status} />
              </div>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => onView(current)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3 border rounded-lg text-sm hover:bg-muted transition-colors"
                >
                  <Receipt className="w-4 h-4" /> View Slip
                </button>
                {canGenerate && EDITABLE_STATUSES.includes(current.status) && (
                  <button
                    type="button"
                    onClick={() => onGenerate(selectedMonth)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3 border rounded-lg text-sm hover:bg-muted transition-colors"
                  >
                    <FileText className="w-4 h-4" /> Regenerate
                  </button>
                )}
                {PAYABLE_STATUSES.includes(current.status) ? (
                  <button
                    type="button"
                    onClick={() => onPayout(current)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                  >
                    <Wallet className="w-4 h-4" /> Process Payout
                  </button>
                ) : (
                  successfulPayout(current) && (
                    <button
                      type="button"
                      onClick={() =>
                        onPayoutDetails(current, successfulPayout(current)!)
                      }
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3 border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                      <BadgeCheck className="w-4 h-4 text-emerald-600" /> Payout
                      Details
                    </button>
                  )
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">
                No salary slip for {formatPayrollMonth(year, month)} yet
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monthlySalary
                  ? `Monthly salary on record: ${formatCurrency(monthlySalary)}`
                  : "No monthly salary is set for this teacher."}
              </p>
            </div>
            {canGenerate && (
              <button
                type="button"
                onClick={() => onGenerate(selectedMonth)}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              >
                <FileText className="w-4 h-4" /> Generate Salary Slip
              </button>
            )}
          </div>
        )}
      </section>

      {/* Salary history */}
      <section className="rounded-xl border bg-card">
        <div className="p-4 border-b space-y-3">
          <h3 className="text-sm font-semibold">Salary History</h3>
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                aria-label="Search salary history"
                placeholder="Search slip no. or transaction ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <select
              aria-label="Filter by month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className={selectCls}
            >
              <option value="ALL">All months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by year"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className={selectCls}
            >
              <option value="ALL">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${selectCls} col-span-2 lg:col-span-1`}
            >
              <option value="ALL">All statuses</option>
              {SLIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-sm font-medium">
              {filtersActive
                ? "No salary records match these filters."
                : "No salary records yet."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setYearFilter("ALL");
                  setMonthFilter("ALL");
                  setStatusFilter("ALL");
                  setQuery("");
                }}
                className="mt-3 h-8 px-3 border rounded-lg text-xs hover:bg-muted transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="font-medium px-4 py-2.5">Month</th>
                    <th className="font-medium px-4 py-2.5 text-right">
                      Gross Salary
                    </th>
                    <th className="font-medium px-4 py-2.5 text-right">
                      Deductions
                    </th>
                    <th className="font-medium px-4 py-2.5 text-right">
                      Net Salary
                    </th>
                    <th className="font-medium px-4 py-2.5">Status</th>
                    <th className="font-medium px-4 py-2.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">
                          {formatPayrollMonth(s.year, s.month)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          #{s.slipNumber}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCurrency(s.grossSalary)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCurrency(s.totalDeductions)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {formatCurrency(s.netSalary)}
                      </td>
                      <td className="px-4 py-2.5">
                        <SlipStatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex justify-end">{rowActions(s)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y">
              {filtered.map((s) => (
                <li key={s.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {formatPayrollMonth(s.year, s.month)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{s.slipNumber}
                      </p>
                    </div>
                    <SlipStatusBadge status={s.status} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Gross</dt>
                      <dd className="tabular-nums font-medium">
                        {formatCurrency(s.grossSalary)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Deductions</dt>
                      <dd className="tabular-nums font-medium">
                        {formatCurrency(s.totalDeductions)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Net</dt>
                      <dd className="tabular-nums font-semibold">
                        {formatCurrency(s.netSalary)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex justify-end -mr-2">{rowActions(s)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Payout history */}
      <section className="rounded-xl border bg-card">
        <h3 className="text-sm font-semibold p-4 border-b">Payout History</h3>
        {payouts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No payouts have been processed yet.
          </p>
        ) : (
          <ul className="divide-y">
            {payouts.map(({ slip, payout }) => (
              <li key={payout.id}>
                <button
                  type="button"
                  onClick={() => onPayoutDetails(slip, payout)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatPayrollMonth(slip.year, slip.month)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {methodLabel(payout.method)} ·{" "}
                      {formatDate(payout.processedAt ?? payout.createdAt)} ·{" "}
                      <span className="font-mono">{payout.transactionId}</span>
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(payout.amount)}
                  </span>
                  <PayoutStatusBadge status={payout.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
