"use client";

import { cn } from "@schoolos/utils";
import { STATUS_META, type SalarySlipStatus } from "@/lib/payroll";

/** Dialog className that turns into a near full-screen sheet on phones. */
export const MOBILE_SHEET =
  "max-sm:max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-0";

export function SlipStatusBadge({
  status,
  className,
}: Readonly<{ status: SalarySlipStatus; className?: string }>) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}

export function DetailRow({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="font-medium text-right min-w-0 break-words">
        {children}
      </span>
    </div>
  );
}

export function AmountInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: Readonly<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
}>) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
        ₹
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder="0"
        className={cn(
          "w-full h-10 pl-7 pr-3 rounded-lg border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent",
          invalid && "border-red-400",
        )}
      />
    </div>
  );
}
