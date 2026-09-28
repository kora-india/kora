"use client";

import { BadgeCheck } from "lucide-react";
import { cn, formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import {
  formatPayrollMonth,
  methodLabel,
  type PayoutRecord,
  type SalarySlipRecord,
} from "@/lib/payroll";
import { formatDate } from "../profile/types";
import { DetailRow, MOBILE_SHEET } from "./ui";

const PAYOUT_STATUS: Record<
  PayoutRecord["status"],
  { label: string; className: string }
> = {
  SUCCEEDED: {
    label: "Paid",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  PROCESSING: {
    label: "Processing",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  FAILED: {
    label: "Failed",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
};

export function PayoutStatusBadge({
  status,
}: Readonly<{ status: PayoutRecord["status"] }>) {
  const meta = PAYOUT_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function PayoutDetailsDialog({
  target,
  onClose,
}: Readonly<{
  target: { slip: SalarySlipRecord; payout: PayoutRecord } | null;
  onClose: () => void;
}>) {
  if (!target) return null;
  const { slip, payout } = target;
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => !open && onClose()}
      title="Payout Details"
      description={`${formatPayrollMonth(slip.year, slip.month)} · Slip #${slip.slipNumber}`}
      icon={<BadgeCheck className="w-5 h-5" />}
      className={`max-w-md ${MOBILE_SHEET}`}
    >
      <div className="rounded-lg border px-4 divide-y">
        <DetailRow label="Status">
          <PayoutStatusBadge status={payout.status} />
        </DetailRow>
        <DetailRow label="Amount">
          <span className="tabular-nums">{formatCurrency(payout.amount)}</span>
        </DetailRow>
        <DetailRow label="Payment Method">
          {methodLabel(payout.method)}
        </DetailRow>
        <DetailRow label="Transaction ID">
          <span className="font-mono text-xs">{payout.transactionId}</span>
        </DetailRow>
        <DetailRow label="Processed On">
          {formatDate(payout.processedAt ?? payout.createdAt)}
        </DetailRow>
        <DetailRow label="Payment Reference">
          {payout.reference || (
            <span className="text-muted-foreground font-normal">—</span>
          )}
        </DetailRow>
        {payout.failureReason && (
          <DetailRow label="Failure Reason">{payout.failureReason}</DetailRow>
        )}
      </div>
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          Close
        </button>
      </div>
    </Dialog>
  );
}
