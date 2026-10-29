"use client";

import React from "react";
import { formatCurrency } from "@schoolos/utils";
import { ExternalLink, FileText, Receipt } from "lucide-react";
import { roleLabel } from "@/lib/activity-labels";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { LedgerRow, LedgerRowKind } from "@/lib/reports/ledger";
import { dateTimeParts } from "./format";
import { LedgerPagination } from "./ledger-pagination";

const AMOUNT: Record<LedgerRowKind, { sign: string; tone: string }> = {
  collection: { sign: "+", tone: "text-emerald-600 dark:text-emerald-400" },
  expense: { sign: "−", tone: "text-rose-600 dark:text-rose-400" },
  // Moves money already counted, so neither in nor out.
  settlement: { sign: "", tone: "text-muted-foreground" },
  advance: { sign: "", tone: "text-muted-foreground" },
};

interface LedgerTableProps {
  rows: LedgerRow[];
  page: number;
  pageSize: number;
  total: number;
  timeZone: string;
  onPage: (page: number) => void;
  onViewReceipt: (receiptNo: string) => void;
}

export function LedgerTable({
  rows,
  page,
  pageSize,
  total,
  timeZone,
  onPage,
  onViewReceipt,
}: Readonly<LedgerTableProps>) {
  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/40 text-muted-foreground border-b text-xs">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Receipt / Ref</th>
              <th className="px-4 py-2.5 font-medium">Particulars</th>
              <th className="px-4 py-2.5 font-medium">Mode</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium">Done by</th>
              <th className="px-4 py-2.5 print:hidden">
                <span className="sr-only">Receipt</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const when = dateTimeParts(row.date, timeZone);
              const amount = AMOUNT[row.kind];
              return (
                <tr key={row.key} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium">{when.date}</p>
                    <p className="text-xs text-muted-foreground">{when.time}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                    {row.receiptNo || row.reference || (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                    {row.receiptNo && row.reference && (
                      <p className="text-muted-foreground">{row.reference}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-48">
                    <p className="font-medium">{row.particulars}</p>
                    {row.detail && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {row.detail}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {row.method ? paymentMethodLabel(row.method) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums ${amount.tone}`}
                  >
                    {amount.sign}
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.doneBy ? (
                      <>
                        <p>{row.doneBy.name}</p>
                        {row.doneBy.name !== roleLabel(row.doneBy.role) && (
                          <p className="text-xs text-muted-foreground">
                            {roleLabel(row.doneBy.role)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span
                        className="text-muted-foreground/60"
                        title={
                          row.kind === "collection"
                            ? "Taken before the ledger recorded who took payments"
                            : undefined
                        }
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap print:hidden">
                    {row.kind === "collection" && row.receiptNo ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(row.receiptNo!)}
                        aria-label={`View receipt ${row.receiptNo}`}
                        title="View receipt"
                        className="inline-flex p-1.5 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    ) : row.billUrl ? (
                      <a
                        href={row.billUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open bill"
                        title="Open bill"
                        className="inline-flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-medium">Nothing here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No collections or expenses match these filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <LedgerPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPage={onPage}
        />
      )}
    </div>
  );
}
