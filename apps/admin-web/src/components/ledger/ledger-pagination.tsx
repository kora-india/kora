"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** "1–25 of 312" with previous and next page buttons. */
export function LedgerPagination({
  page,
  pageSize,
  total,
  onPage,
}: Readonly<{
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-xs text-muted-foreground print:hidden">
      <span>
        {first.toLocaleString("en-IN")}–{last.toLocaleString("en-IN")} of{" "}
        {total.toLocaleString("en-IN")}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="p-1.5 rounded-lg border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2">
          Page {Math.min(page, pages)} of {pages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="p-1.5 rounded-lg border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
