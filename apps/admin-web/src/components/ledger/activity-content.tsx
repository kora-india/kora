"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, RotateCcw, Search, X } from "lucide-react";
import { Select } from "antd";
import { Dialog } from "@/components/ui/dialog";
import { LedgerShell } from "./ledger-shell";
import { LedgerPagination } from "./ledger-pagination";
import { PeriodFilter } from "./period-filter";
import { dateTimeParts, personLabel } from "./format";
import { ACTIVITY_MODULES, roleLabel } from "@/lib/activity-labels";
import {
  ACTIVITY_PAGE_SIZE,
  DEFAULT_ACTIVITY_QUERY,
  activityQueryToSearch,
  type ActivityQuery,
} from "@/lib/reports/activity-query";
import type { ActivityRow } from "@/lib/reports/activity";
import { paymentMethodLabel } from "@/lib/payment-methods";

interface Props {
  /** The filters the server applied (from the URL). */
  query: ActivityQuery;
  rows: ActivityRow[];
  total: number;
  people: { id: string; name: string; role: string; isActive: boolean }[];
  timeZone: string;
}

/** Sign-ins that didn't go through stand out. */
const isWarning = (action: string) =>
  action === "auth.login_failed" || action === "auth.login_blocked";

export function ActivityContent({
  query,
  rows,
  total,
  people,
  timeZone,
}: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState<ActivityRow | null>(null);

  const [filters, setFiltersState] = useState(query);
  const latest = useRef(filters);
  const setFilters = (next: ActivityQuery) => {
    latest.current = next;
    setFiltersState(next);
  };
  const requested = useRef(activityQueryToSearch(query));
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const navigate = (next: ActivityQuery) => {
    const search = activityQueryToSearch(next);
    if (search === requested.current) return;
    requested.current = search;
    startTransition(() => {
      router.replace(`${pathname}${search}`, { scroll: false });
    });
  };

  // The URL changed from outside (a link, back/forward): show its filters.
  const appliedSearch = activityQueryToSearch(query);
  useEffect(() => {
    if (appliedSearch !== requested.current) {
      requested.current = appliedSearch;
      setFilters(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const handleChange = (patch: Partial<ActivityQuery>) => {
    const next = { ...latest.current, ...patch, page: 1 };
    setFilters(next);
    clearTimeout(searchTimer.current);
    const go = () => navigate(next);
    if ("q" in patch) searchTimer.current = setTimeout(go, 400);
    else if (!(next.period === "custom" && !next.from && !next.to)) go();
  };

  const handleReset = () => {
    clearTimeout(searchTimer.current);
    setFilters(DEFAULT_ACTIVITY_QUERY);
    navigate(DEFAULT_ACTIVITY_QUERY);
  };

  const hasFilters =
    filters.who !== "all" ||
    filters.module !== "all" ||
    filters.period !== "all" ||
    filters.q.trim() !== "";

  return (
    <LedgerShell tab="activity" showTabs>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="relative w-full sm:flex-1 sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search what happened or who did it…"
            value={filters.q}
            onChange={(e) => handleChange({ q: e.target.value })}
            className="w-full h-8 pl-9 pr-8 text-sm rounded-[10px] border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
          {filters.q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => handleChange({ q: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select
          value={filters.who}
          onChange={(who) => handleChange({ who })}
          className="w-full sm:w-56"
          aria-label="Person"
          showSearch
          optionFilterProp="label"
          options={[
            { value: "all", label: "Everyone" },
            { value: "system", label: "System (automatic)" },
            ...people.map((p) => ({
              value: p.id,
              label: `${p.name} · ${roleLabel(p.role)}${p.isActive ? "" : " (removed)"}`,
            })),
          ]}
        />
        <Select
          value={filters.module}
          onChange={(area) => handleChange({ module: area })}
          className="w-full sm:w-40"
          aria-label="Area"
          options={[
            { value: "all", label: "All areas" },
            ...Object.entries(ACTIVITY_MODULES).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <PeriodFilter
          value={filters}
          onChange={(period) => handleChange(period)}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-[10px] hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      <div
        aria-busy={isPending}
        className={`bg-card border rounded-2xl shadow-sm overflow-hidden transition-opacity ${isPending ? "opacity-60" : ""}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground border-b text-xs">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">What happened</th>
                <th className="px-4 py-2.5 font-medium">Area</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => {
                const when = dateTimeParts(row.createdAt, timeZone);
                return (
                  <tr
                    key={row.id}
                    onClick={() => setOpen(row)}
                    className="hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium">{when.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {when.time}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p>{row.actorName}</p>
                      {row.actorName !== roleLabel(row.actorRole) && (
                        <p className="text-xs text-muted-foreground">
                          {roleLabel(row.actorRole)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-64">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(row);
                        }}
                        className={`text-left hover:underline cursor-pointer ${
                          isWarning(row.action)
                            ? "text-rose-600 dark:text-rose-400"
                            : ""
                        }`}
                      >
                        {row.summary}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {ACTIVITY_MODULES[
                          row.module as keyof typeof ACTIVITY_MODULES
                        ] ?? row.module}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12">
                    <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-medium">No activity</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasFilters
                        ? "Nothing matches these filters."
                        : "Sign-ins and changes will show here as people use the app."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <LedgerPagination
            page={query.page}
            pageSize={ACTIVITY_PAGE_SIZE}
            total={total}
            onPage={(page) => {
              setFilters({ ...latest.current, page });
              navigate({ ...query, page });
            }}
          />
        )}
      </div>

      <Dialog
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Activity details"
        icon={<History className="w-5 h-5" />}
      >
        {open && <ActivityDetails row={open} timeZone={timeZone} />}
      </Dialog>
    </LedgerShell>
  );
}

function ActivityDetails({
  row,
  timeZone,
}: Readonly<{ row: ActivityRow; timeZone: string }>) {
  const when = dateTimeParts(row.createdAt, timeZone);
  const facts: [string, string][] = [
    ["When", `${when.date}, ${when.time}`],
    ["Who", personLabel({ name: row.actorName, role: row.actorRole })],
    [
      "Area",
      ACTIVITY_MODULES[row.module as keyof typeof ACTIVITY_MODULES] ??
        row.module,
    ],
    ...(row.ip ? ([["IP address", row.ip]] as [string, string][]) : []),
    ...(row.userAgent
      ? ([["Device", row.userAgent]] as [string, string][])
      : []),
  ];

  const details = readableDetails(row.details);

  return (
    <div className="space-y-4 text-sm">
      <p
        className={`font-medium ${isWarning(row.action) ? "text-rose-600 dark:text-rose-400" : ""}`}
      >
        {row.summary}
      </p>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        {facts.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {details.length > 0 && (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 border-t pt-4">
          {details.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

/** "receiptNo" → "Receipt no". */
const labelFor = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

const valueFor = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(valueFor).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${labelFor(k)}: ${valueFor(v)}`)
      .join("; ");
  }
  return String(value);
};

/** The entry's extra facts as label and value, without internal ids. */
function readableDetails(details: ActivityRow["details"]): [string, string][] {
  if (!details) return [];
  return Object.entries(details)
    .filter(([key]) => !/Ids?$/.test(key))
    .map(([key, value]) => [
      labelFor(key),
      key === "method" && typeof value === "string"
        ? paymentMethodLabel(value)
        : valueFor(value),
    ]);
}
