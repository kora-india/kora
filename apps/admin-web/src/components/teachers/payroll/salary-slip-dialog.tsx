"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer, Receipt, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { sendSalarySlip } from "@/lib/actions/payroll";
import {
  PAYABLE_STATUSES,
  formatPayrollMonth,
  methodLabel,
  successfulPayout,
  type SalarySlipRecord,
} from "@/lib/payroll";
import type { ProfileSchool } from "../profile/types";
import { formatDate } from "../profile/types";
import { MOBILE_SHEET, SlipStatusBadge } from "./ui";

interface Props {
  slip: SalarySlipRecord | null;
  onClose: () => void;
  teacher: { name: string; email: string; subject: string };
  school: ProfileSchool | null;
  /** Open the browser print dialog as soon as the slip is shown. */
  autoPrint?: boolean;
  onProcessPayout?: (slip: SalarySlipRecord) => void;
  onSent?: () => void;
}

function Line({
  label,
  value,
  strong,
}: Readonly<{ label: string; value: number; strong?: boolean }>) {
  return (
    <div
      className={`flex justify-between py-1.5 text-sm ${strong ? "font-semibold" : ""}`}
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

export function SalarySlipDialog({
  slip,
  onClose,
  teacher,
  school,
  autoPrint,
  onProcessPayout,
  onSent,
}: Readonly<Props>) {
  const [sending, setSending] = useState(false);
  const printedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!slip || !autoPrint || printedFor.current === slip.id) return;
    printedFor.current = slip.id;
    // Let the dialog render before opening the print dialog.
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [slip, autoPrint]);

  useEffect(() => {
    if (!slip) printedFor.current = null;
  }, [slip]);

  if (!slip) return null;
  const payout = successfulPayout(slip);
  const period = formatPayrollMonth(slip.year, slip.month);
  const schoolAddress = [school?.address, school?.city, school?.state]
    .filter(Boolean)
    .join(", ");

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await sendSalarySlip(slip.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Salary slip sent to ${res.to}`);
        onSent?.();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={!!slip}
      onOpenChange={(open) => !open && onClose()}
      title={`Salary Slip #${slip.slipNumber}`}
      description={`${teacher.name} · ${period}`}
      icon={<Receipt className="w-5 h-5" />}
      className={`max-w-2xl ${MOBILE_SHEET}`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <SlipStatusBadge status={slip.status} />
          {slip.sentAt && (
            <span className="text-xs text-muted-foreground">
              Emailed {formatDate(slip.sentAt)}
            </span>
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              <Printer className="w-4 h-4" /> Download PDF
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send to Teacher
            </button>
            {onProcessPayout && PAYABLE_STATUSES.includes(slip.status) && (
              <button
                type="button"
                onClick={() => onProcessPayout(slip)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              >
                <Wallet className="w-4 h-4" /> Process Payout
              </button>
            )}
          </div>
        </div>

        {/* Printable slip */}
        <article className="salary-slip-print rounded-xl border bg-card p-5 sm:p-6 text-foreground">
          <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b">
            <div className="min-w-0">
              <p className="text-base font-bold">{school?.name ?? "School"}</p>
              {schoolAddress && (
                <p className="text-xs text-muted-foreground">{schoolAddress}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm font-semibold">Salary Slip</p>
              <p className="text-xs text-muted-foreground">
                #{slip.slipNumber}
              </p>
            </div>
          </header>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 border-b text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Teacher</dt>
              <dd className="font-medium">{teacher.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Salary Month</dt>
              <dd className="font-medium">{period}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Subject</dt>
              <dd className="font-medium">{teacher.subject}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Issued On</dt>
              <dd className="font-medium">{formatDate(slip.createdAt)}</dd>
            </div>
          </dl>

          <div className="grid gap-6 sm:grid-cols-2 py-4 border-b">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Earnings
              </h4>
              <Line label="Basic Salary" value={slip.basicSalary} />
              <Line label="Allowances" value={slip.allowances} />
              <div className="border-t mt-1">
                <Line label="Gross Salary" value={slip.grossSalary} strong />
              </div>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Deductions
              </h4>
              <Line label="PF" value={slip.pfDeduction} />
              <Line label="Other Deductions" value={slip.otherDeductions} />
              <div className="border-t mt-1">
                <Line
                  label="Total Deductions"
                  value={slip.totalDeductions}
                  strong
                />
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between pt-4">
            <span className="text-sm font-semibold">Net Salary</span>
            <span className="text-xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
              {formatCurrency(slip.netSalary)}
            </span>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {payout
              ? `Paid on ${formatDate(payout.processedAt)} via ${methodLabel(payout.method)} · Transaction ${payout.transactionId}`
              : "Payment status: not yet paid"}
          </p>
        </article>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .salary-slip-print,
          .salary-slip-print * {
            visibility: visible;
          }
          .salary-slip-print {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            border: 1px solid #ccc !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>
    </Dialog>
  );
}
