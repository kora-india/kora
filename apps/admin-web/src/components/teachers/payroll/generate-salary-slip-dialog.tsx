"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { selectCls } from "@/components/ui/form-field";
import { generateSalarySlip } from "@/lib/actions/payroll";
import {
  EDITABLE_STATUSES,
  MAX_AMOUNT,
  STATUS_META,
  computeSalary,
  formatPayrollMonth,
  monthKey,
  parseMonthKey,
  recentMonths,
  type SalarySlipRecord,
} from "@/lib/payroll";
import { AmountInput, MOBILE_SHEET } from "./ui";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: { id: string; name: string; salary: number | null };
  slips: SalarySlipRecord[];
  /** Month to preselect, e.g. the month selected on the payroll tab. */
  initialMonth?: string;
  onGenerated: (slip: SalarySlipRecord) => void;
}

type Field = "basicSalary" | "allowances" | "pfDeduction" | "otherDeductions";
const FIELDS: { key: Field; label: string }[] = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "allowances", label: "Allowances" },
  { key: "pfDeduction", label: "PF" },
  { key: "otherDeductions", label: "Other Deduction" },
];

const toStr = (n: number) => (n ? String(n) : "");

function validateAmount(raw: string, label: string, required = false) {
  if (raw.trim() === "") return required ? `${label} is required` : null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return `Enter a valid amount`;
  const n = Number(raw);
  if (required && n <= 0) return `${label} must be more than ₹0`;
  if (n > MAX_AMOUNT) return `${label} is too large`;
  return null;
}

export function GenerateSalarySlipDialog({
  open,
  onOpenChange,
  teacher,
  slips,
  initialMonth,
  onGenerated,
}: Readonly<Props>) {
  const months = useMemo(() => recentMonths(12), []);
  const [month, setMonth] = useState(
    initialMonth ?? monthKey(months[0].year, months[0].month),
  );
  const [values, setValues] = useState<Record<Field, string>>({
    basicSalary: "",
    allowances: "",
    pfDeduction: "",
    otherDeductions: "",
  });
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const existing = useMemo(() => {
    const { year, month: m } = parseMonthKey(month);
    return slips.find((s) => s.year === year && s.month === m) ?? null;
  }, [slips, month]);
  const locked = existing && !EDITABLE_STATUSES.includes(existing.status);

  // Prefill: the existing slip for this month, else last month's structure,
  // else the teacher's monthly salary as the basic.
  const prefill = (key: string) => {
    const { year, month: m } = parseMonthKey(key);
    const same = slips.find((s) => s.year === year && s.month === m);
    const source = same ?? slips[0];
    if (source) {
      setValues({
        basicSalary: toStr(source.basicSalary),
        allowances: toStr(source.allowances),
        pfDeduction: toStr(source.pfDeduction),
        otherDeductions: toStr(source.otherDeductions),
      });
    } else {
      setValues({
        basicSalary: toStr(teacher.salary ?? 0),
        allowances: "",
        pfDeduction: "",
        otherDeductions: "",
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    const key = initialMonth ?? monthKey(months[0].year, months[0].month);
    setMonth(key);
    prefill(key);
    setShowErrors(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors: Partial<Record<Field, string>> = {};
  for (const f of FIELDS) {
    const e = validateAmount(values[f.key], f.label, f.key === "basicSalary");
    if (e) errors[f.key] = e;
  }
  const n = (k: Field) => Number(values[k]) || 0;
  const totals = computeSalary({
    basicSalary: n("basicSalary"),
    allowances: n("allowances"),
    pfDeduction: n("pfDeduction"),
    otherDeductions: n("otherDeductions"),
  });
  const negativeNet = totals.netSalary < 0;
  const hasErrors = Object.keys(errors).length > 0 || negativeNet;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || locked) return;
    setShowErrors(true);
    if (hasErrors) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { year, month: m } = parseMonthKey(month);
      const res = await generateSalarySlip({
        teacherId: teacher.id,
        year,
        month: m,
        basicSalary: n("basicSalary"),
        allowances: n("allowances"),
        pfDeduction: n("pfDeduction"),
        otherDeductions: n("otherDeductions"),
      });
      if (res.error || !res.slip) {
        toast.error(res.error ?? "Failed to generate salary slip");
        return;
      }
      toast.success(
        res.updated
          ? `Salary slip ${res.slip.slipNumber} updated`
          : `Salary slip ${res.slip.slipNumber} generated`,
      );
      onGenerated(res.slip);
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate salary slip");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const field = (key: Field, label: string) => (
    <div className="space-y-1.5">
      <label htmlFor={`slip-${key}`} className="text-xs font-medium block">
        {label}
        {key === "basicSalary" && (
          <span className="text-red-500 ml-0.5">*</span>
        )}
      </label>
      <AmountInput
        id={`slip-${key}`}
        value={values[key]}
        onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
        invalid={showErrors && !!errors[key]}
        describedBy={errors[key] ? `slip-${key}-err` : undefined}
      />
      {showErrors && errors[key] && (
        <p id={`slip-${key}-err`} className="text-xs text-red-500">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submittingRef.current) return;
        onOpenChange(next);
      }}
      title="Generate Salary Slip"
      description="Salary slips don't mark the salary as paid. Process the payout separately."
      icon={<FileText className="w-5 h-5" />}
      className={`max-w-lg ${MOBILE_SHEET}`}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Teacher</p>
            <p className="h-10 px-3 rounded-lg border bg-muted/40 text-sm flex items-center truncate">
              {teacher.name}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="slip-month" className="text-xs font-medium block">
              Salary Month<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              id="slip-month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                prefill(e.target.value);
                setShowErrors(false);
              }}
              className={`${selectCls} h-10`}
            >
              {months.map((mo) => {
                const key = monthKey(mo.year, mo.month);
                const slip = slips.find(
                  (s) => s.year === mo.year && s.month === mo.month,
                );
                return (
                  <option key={key} value={key}>
                    {formatPayrollMonth(mo.year, mo.month)}
                    {slip ? ` · ${STATUS_META[slip.status].label}` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {existing && (
          <div
            role={locked ? "alert" : "status"}
            className={`flex gap-2 rounded-lg border px-3 py-2.5 text-xs ${
              locked
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
            <p>
              {locked
                ? `The ${formatPayrollMonth(existing.year, existing.month)} salary is ${STATUS_META[existing.status].label.toLowerCase()}, so its slip can't be changed.`
                : `Slip ${existing.slipNumber} already exists for this month. Generating again will update it.`}
            </p>
          </div>
        )}

        <fieldset disabled={!!locked} className="space-y-5 disabled:opacity-60">
          <div>
            <p className="text-sm font-semibold mb-3">Earnings</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("basicSalary", "Basic Salary")}
              {field("allowances", "Allowances")}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Deductions</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("pfDeduction", "PF")}
              {field("otherDeductions", "Other Deduction")}
            </div>
          </div>
        </fieldset>

        <div
          aria-live="polite"
          className="rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 p-4 space-y-2 text-sm"
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross Salary</span>
            <span className="font-medium tabular-nums">
              {formatCurrency(totals.grossSalary)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Deductions</span>
            <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
              − {formatCurrency(totals.totalDeductions)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-violet-200/70 dark:border-violet-900/60">
            <span className="font-semibold">Net Salary</span>
            <span
              className={`text-base font-bold tabular-nums ${negativeNet ? "text-red-600" : "text-violet-700 dark:text-violet-300"}`}
            >
              {formatCurrency(totals.netSalary)}
            </span>
          </div>
          {negativeNet && (
            <p className="text-xs text-red-500">
              Deductions can't be more than the gross salary.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-4 bg-card border-t flex gap-2 justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none h-10 px-4 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !!locked}
            className="flex-1 sm:flex-none h-10 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting
              ? "Generating…"
              : existing && !locked
                ? "Update Salary Slip"
                : "Generate Salary Slip"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
