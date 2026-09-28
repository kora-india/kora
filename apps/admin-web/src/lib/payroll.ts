/**
 * Payroll helpers shared by server actions and client components.
 *
 * Concepts are deliberately separate:
 *  - Salary slip: the monthly statement (gross, deductions, net).
 *  - Payout: the act of paying a slip. Only a successful payout marks a slip PAID.
 */

export type SalarySlipStatus =
  | "DRAFT"
  | "GENERATED"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "FAILED";

export type PayoutStatus = "PROCESSING" | "SUCCEEDED" | "FAILED";

export type PayoutMethod = "BANK_TRANSFER" | "UPI" | "CASH";

export const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
];

export const SLIP_STATUSES: SalarySlipStatus[] = [
  "DRAFT",
  "GENERATED",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "FAILED",
];

/** Statuses from which a payout may be started. */
export const PAYABLE_STATUSES: SalarySlipStatus[] = [
  "GENERATED",
  "APPROVED",
  "FAILED",
];

/** Statuses in which a slip may still be regenerated/edited. */
export const EDITABLE_STATUSES: SalarySlipStatus[] = [
  "DRAFT",
  "GENERATED",
  "APPROVED",
  "FAILED",
];

export const MAX_AMOUNT = 10_000_000;

export interface SalaryInputs {
  basicSalary: number;
  allowances: number;
  pfDeduction: number;
  otherDeductions: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeSalary(i: SalaryInputs) {
  const grossSalary = round2(i.basicSalary + i.allowances);
  const totalDeductions = round2(i.pfDeduction + i.otherDeductions);
  const netSalary = round2(grossSalary - totalDeductions);
  return { grossSalary, totalDeductions, netSalary };
}

export function methodLabel(method: string): string {
  return (
    PAYOUT_METHODS.find((m) => m.value === method)?.label ??
    method
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? "";
}

export function formatPayrollMonth(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

/** The current month and the previous `count - 1` months, newest first. */
export function recentMonths(count = 12, from = new Date()) {
  const out: { year: number; month: number }[] = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** Never show a full account number: keep only the last four digits. */
export function maskAccount(account?: string | null): string | null {
  if (!account) return null;
  const digits = account.replace(/\s+/g, "");
  if (digits.length < 4) return null;
  return `•••• ${digits.slice(-4)}`;
}

export const STATUS_META: Record<
  SalarySlipStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  GENERATED: {
    label: "Generated",
    className:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  },
  APPROVED: {
    label: "Approved",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
  },
  PROCESSING: {
    label: "Processing",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  PAID: {
    label: "Paid",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  FAILED: {
    label: "Failed",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
};

/* ───────────── Serialisable shapes passed from server to client ───────────── */

export interface PayoutRecord {
  id: string;
  amount: number;
  method: string;
  status: PayoutStatus;
  transactionId: string;
  reference: string | null;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface SalarySlipRecord {
  id: string;
  slipNumber: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  pfDeduction: number;
  otherDeductions: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: SalarySlipStatus;
  sentAt: string | null;
  createdAt: string;
  payouts: PayoutRecord[];
}

type Decimalish = { toString(): string } | number | string;
const num = (v: Decimalish | null | undefined) =>
  v == null ? 0 : Number(v.toString());

/** Convert a Prisma SalarySlip (with payouts) into a plain client object. */
export function serializeSlip(s: any): SalarySlipRecord {
  return {
    id: s.id,
    slipNumber: s.slipNumber,
    month: s.month,
    year: s.year,
    basicSalary: num(s.basicSalary),
    allowances: num(s.allowances),
    pfDeduction: num(s.pfDeduction),
    otherDeductions: num(s.otherDeductions),
    grossSalary: num(s.grossSalary),
    totalDeductions: num(s.totalDeductions),
    netSalary: num(s.netSalary),
    status: s.status,
    sentAt: s.sentAt ? new Date(s.sentAt).toISOString() : null,
    createdAt: new Date(s.createdAt).toISOString(),
    payouts: (s.payouts ?? []).map(
      (p: any): PayoutRecord => ({
        id: p.id,
        amount: num(p.amount),
        method: p.method,
        status: p.status,
        transactionId: p.transactionId,
        reference: p.reference ?? null,
        failureReason: p.failureReason ?? null,
        processedAt: p.processedAt
          ? new Date(p.processedAt).toISOString()
          : null,
        createdAt: new Date(p.createdAt).toISOString(),
      }),
    ),
  };
}

export function successfulPayout(slip: SalarySlipRecord) {
  return slip.payouts.find((p) => p.status === "SUCCEEDED") ?? null;
}
