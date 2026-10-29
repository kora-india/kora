"use client";

import React from "react";
import { formatCurrency } from "@schoolos/utils";
import type { LedgerMetrics } from "@/lib/reports/ledger";

/** Collected, spent, net and still owed, for the filtered period. */
export function LedgerStatCards({
  metrics: m,
}: Readonly<{ metrics: LedgerMetrics }>) {
  const plural = (n: number, word: string) =>
    `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        label="Collected"
        value={formatCurrency(m.totalInflow)}
        note={plural(m.inflowCount, "receipt")}
        tone="text-emerald-600 dark:text-emerald-400"
      />
      <Stat
        label="Spent"
        value={formatCurrency(m.totalOutflow)}
        note={plural(m.outflowCount, "expense")}
        tone="text-rose-600 dark:text-rose-400"
      />
      <Stat
        label="Net"
        value={formatCurrency(m.netPosition)}
        note="Collected minus spent"
        tone={
          m.netPosition >= 0
            ? "text-foreground"
            : "text-rose-600 dark:text-rose-400"
        }
      />
      <Stat
        label="Outstanding dues"
        value={formatCurrency(m.totalReceivables)}
        note={`${m.collectionRate}% of billed fees paid`}
        tone="text-amber-600 dark:text-amber-400"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: Readonly<{ label: string; value: string; note: string; tone: string }>) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl md:text-2xl font-bold tabular-nums ${tone}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
