"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { inputCls } from "@/components/ui/form-field";
import { processPayout } from "@/lib/actions/payroll";
import {
  PAYOUT_METHODS,
  formatPayrollMonth,
  maskAccount,
  type PayoutMethod,
  type PayoutRecord,
  type SalarySlipRecord,
} from "@/lib/payroll";
import { DetailRow, MOBILE_SHEET } from "./ui";

interface Props {
  slip: SalarySlipRecord | null;
  teacherName: string;
  /** Bank account on file, if the data model ever provides one. */
  bankAccount?: string | null;
  onClose: () => void;
  onPaid: (slip: SalarySlipRecord) => void;
}

const REFERENCE_LABEL: Record<PayoutMethod, string> = {
  BANK_TRANSFER: "UTR / Bank Reference",
  UPI: "UPI Transaction ID",
  CASH: "Voucher / Receipt No.",
};

export function ProcessPayoutDialog({
  slip,
  teacherName,
  bankAccount,
  onClose,
  onPaid,
}: Readonly<Props>) {
  const [method, setMethod] = useState<PayoutMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<PayoutRecord | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!slip) return;
    setMethod("BANK_TRANSFER");
    setReference("");
    setDone(null);
  }, [slip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slip) return null;
  const period = formatPayrollMonth(slip.year, slip.month);
  const masked = maskAccount(bankAccount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against double clicks and double Enter presses.
    if (submittingRef.current || done) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await processPayout({
        slipId: slip.id,
        method,
        reference: reference.trim() || null,
      });
      if (res.error || !res.payout || !res.slip) {
        toast.error(res.error ?? "Payout failed");
        return;
      }
      setDone(res.payout);
      toast.success("Salary payout processed");
      onPaid(res.slip);
    } catch (err: any) {
      toast.error(err?.message || "Payout failed");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!slip}
      onOpenChange={(open) => {
        if (!open && !submittingRef.current) onClose();
      }}
      title={done ? "Payout Complete" : "Process Salary Payout"}
      description={
        done ? undefined : "Record the salary payment for this month."
      }
      icon={<Wallet className="w-5 h-5" />}
      className={`max-w-md ${MOBILE_SHEET}`}
    >
      {done ? (
        <div className="text-center space-y-4 py-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">Salary payout processed</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {formatCurrency(done.amount)}
            </p>
            <p className="text-sm text-muted-foreground">{period}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 text-left divide-y">
            <DetailRow label="Transaction ID">
              <span className="font-mono text-xs">{done.transactionId}</span>
            </DetailRow>
            {done.reference && (
              <DetailRow label="Reference">{done.reference}</DetailRow>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-lg border px-4 divide-y">
            <DetailRow label="Teacher">{teacherName}</DetailRow>
            <DetailRow label="Salary Month">{period}</DetailRow>
            <DetailRow label="Net Payable">
              <span className="text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">
                {formatCurrency(slip.netSalary)}
              </span>
            </DetailRow>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium mb-2">Payment Method</legend>
            <div className="grid grid-cols-3 gap-2">
              {PAYOUT_METHODS.map((m) => (
                <label
                  key={m.value}
                  className={cn(
                    "flex items-center justify-center gap-2 h-10 px-2 rounded-lg border text-sm cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500",
                    method === m.value
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="payout-method"
                    value={m.value}
                    checked={method === m.value}
                    onChange={() => setMethod(m.value)}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              ))}
            </div>
            {method === "BANK_TRANSFER" && (
              <p className="flex gap-1.5 text-xs text-muted-foreground pt-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                {masked
                  ? `Account ${masked}`
                  : "No bank account is on file for this teacher. Enter the bank's UTR as the reference."}
              </p>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="payout-ref" className="text-xs font-medium block">
              {REFERENCE_LABEL[method]}{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </label>
            <input
              id="payout-ref"
              value={reference}
              maxLength={100}
              onChange={(e) => setReference(e.target.value)}
              className={`${inputCls} h-10`}
              autoComplete="off"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Kora records this payout; it doesn't transfer money. Make the
            payment through your bank, UPI app or in cash.
          </p>

          <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-4 bg-card border-t flex gap-2 justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 sm:flex-none h-10 px-4 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="flex-1 sm:flex-none h-10 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Processing…" : "Process Payout"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
