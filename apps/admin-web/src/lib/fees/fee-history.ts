/**
 * Full fee history: a school's bills and payments, month by month. The school
 * fills a template with one row per student and a group of columns per month:
 * fees, late fee, what was paid, when, how, and the receipt. Each filled month
 * becomes one `FeeHistoryRow`. Pure functions, shared by the import dialog and
 * the server.
 */

import { PAYMENT_METHOD_OPTIONS } from "../payment-methods";
import { parseImportDate } from "../student-import-helpers";
import {
  formatPeriodLabel,
  isPeriodKey,
  isPeriodWithinSession,
  parsePeriodKey,
  toPeriodKey,
} from "./billing-period";
import { calculateLateFee, type LateFeeRule } from "./late-fee";
import { parseAmount, type ImportableStudent } from "./opening-balance";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const HISTORY_TEMPLATE_INSTRUCTIONS = [
  "How to fill this file",
  "",
  "There is one row for each student, and a group of columns for each month. Fees are filled in from your fee structure.",
  "1. Fees: the month's total bill. Lower it if there was a discount. Anything above your fee structure goes under Other Fees. Clear it for a month that was never billed.",
  "2. Late Fee: the late fee charged that month. Type 0 if there was none.",
  "3. Paid: what was paid for that month. Leave it blank if nothing was paid.",
  "4. Paid On: the date it was paid, as DD/MM/YYYY.",
  "5. Mode: Cash, UPI, Bank transfer, Cheque, Card or Online.",
  "6. Receipt: your old receipt number. Use the same number in every month one receipt paid for. Leave it blank if you don't have one.",
  "7. Two payments for one month? Add a new row with only the Admission Number and that month's second Paid, Paid On, Mode and Receipt.",
  "8. Don't change the Admission Number column. Save the file and upload it on the Fees page.",
];

/** Bills count as due on the 10th, as the monthly fee run bills them. */
export const historyDueDate = (period: string) => `${period}-10`;

const key = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

export const HISTORY_STUDENT_HEADERS = [
  "Admission Number",
  "Student Name",
  "Class",
  "Section",
];

/** The columns of each month in the template. */
export const HISTORY_MONTH_FIELDS = [
  "Fees (₹)",
  "Late Fee (₹)",
  "Paid (₹)",
  "Paid On",
  "Mode",
  "Receipt",
];

/** "Apr 2026" for "2026-04". */
export function monthLabel(period: string): string {
  const { year, month } = parsePeriodKey(period)!;
  const name = MONTH_NAMES[month - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/** The template's headers for a range of months. */
export const historyHeaders = (months: string[]) => [
  ...HISTORY_STUDENT_HEADERS,
  ...months.flatMap((period) =>
    HISTORY_MONTH_FIELDS.map((field) => `${monthLabel(period)} ${field}`),
  ),
];

/** The headers of one month's columns in a file. */
export interface MonthColumns {
  period: string;
  fees?: string;
  lateFee?: string;
  paid?: string;
  paidOn?: string;
  mode?: string;
  receiptNo?: string;
}

export interface HistoryColumns {
  admissionNumber: string;
  /** Oldest first. */
  months: MonthColumns[];
}

const MONTH_COLUMN =
  /^(.+?)\s+(late\s*fee|fees|paid\s*on|paid|mode|receipt(?:\s*no)?)\s*(?:\([^)]*\))?$/i;

const MONTH_FIELD: Record<string, keyof Omit<MonthColumns, "period">> = {
  latefee: "lateFee",
  fees: "fees",
  paidon: "paidOn",
  paid: "paid",
  mode: "mode",
  receipt: "receiptNo",
  receiptno: "receiptNo",
};

/** Which column is which. `missing` means this isn't the template. */
export function findHistoryColumns(
  headers: string[],
): HistoryColumns | { missing: string[] } {
  let admissionNumber: string | undefined;
  const months = new Map<string, MonthColumns>();
  for (const header of headers) {
    if (key(header) === "admissionnumber") {
      admissionNumber = header;
      continue;
    }
    const match = MONTH_COLUMN.exec(header.trim());
    const period = match && parseMonth(match[1]);
    if (!match || !period) continue;
    const month = months.get(period) ?? { period };
    month[MONTH_FIELD[key(match[2])]] = header;
    months.set(period, month);
  }
  if (!admissionNumber || months.size === 0) {
    return {
      missing: [
        ...(admissionNumber ? [] : ["Admission Number column"]),
        ...(months.size > 0 ? [] : ["month columns"]),
      ],
    };
  }
  return {
    admissionNumber,
    months: [...months.values()].sort((a, b) =>
      a.period.localeCompare(b.period),
    ),
  };
}

/** One filled month of one row of the template. */
export interface FeeHistoryRow {
  sheetRow: number;
  admissionNumber: string;
  /** "YYYY-MM" */
  period: string;
  fees: string;
  lateFee: string;
  paid: string;
  paidOn: string;
  mode: string;
  receiptNo: string;
}

const text = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).trim();

/** The months a sheet row has anything in. */
export function toHistoryRows(
  cells: Record<string, unknown>,
  sheetRow: number,
  columns: HistoryColumns,
): FeeHistoryRow[] {
  const cell = (header?: string) => (header ? text(cells[header]) : "");
  const admissionNumber = cell(columns.admissionNumber);
  return columns.months
    .map((month) => ({
      sheetRow,
      admissionNumber,
      period: month.period,
      fees: cell(month.fees),
      lateFee: cell(month.lateFee),
      paid: cell(month.paid),
      paidOn: cell(month.paidOn),
      mode: cell(month.mode),
      receiptNo: cell(month.receiptNo),
    }))
    .filter((row) => row.fees || row.lateFee || row.paid);
}

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * A month in a column heading as "YYYY-MM": "Apr 2026", "April 2026", "Apr-26",
 * "04/2026", "2026-04", a full date, or the serial number Excel stores a date
 * as.
 */
export function parseMonth(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  let year: number | undefined;
  let month: number | undefined;
  let match: RegExpExecArray | null;

  if ((match = /^(\d{4})[-/](\d{1,2})$/.exec(value))) {
    year = Number(match[1]);
    month = Number(match[2]);
  } else if ((match = /^(\d{1,2})[-/](\d{4})$/.exec(value))) {
    year = Number(match[2]);
    month = Number(match[1]);
  } else if ((match = /^\d{1,2}[-/.](\d{1,2})[-/.](\d{4})$/.exec(value))) {
    year = Number(match[2]);
    month = Number(match[1]);
  } else if (/^\d{5}(\.\d+)?$/.test(value)) {
    // Excel stores dates as days since 30 Dec 1899.
    const date = new Date(
      Date.UTC(1899, 11, 30) + Math.floor(Number(value)) * 86_400_000,
    );
    year = date.getUTCFullYear();
    month = date.getUTCMonth() + 1;
  } else if (
    (match = /^(?:\d{1,2}[\s\-/.])?([a-z]{3,9})[\s\-/.,']*(\d{4}|\d{2})$/.exec(
      value,
    ))
  ) {
    const index = MONTH_NAMES.indexOf(match[1].slice(0, 3));
    if (index >= 0) {
      month = index + 1;
      year = Number(match[2]);
      if (year < 100) year += 2000;
    }
  }

  if (!year || !month || month > 12 || year < 2000 || year > 2100) return null;
  return toPeriodKey(year, month);
}

/** Every month from `from` to `to`, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const start = parsePeriodKey(from);
  const end = parsePeriodKey(to);
  if (!start || !end) return [];
  const months: string[] = [];
  let { year, month } = start;
  while (year * 12 + month <= end.year * 12 + end.month) {
    months.push(toPeriodKey(year, month));
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

const MODE_WORDS: Record<string, string> = {
  gpay: "UPI",
  googlepay: "UPI",
  phonepe: "UPI",
  paytm: "UPI",
  bhim: "UPI",
  bank: "BANK_TRANSFER",
  transfer: "BANK_TRANSFER",
  check: "CHEQUE",
  dd: "CHEQUE",
  demanddraft: "CHEQUE",
  card: "DEBIT_CARD",
  debit: "DEBIT_CARD",
  credit: "CREDIT_CARD",
};

/** A Mode cell as a payment method. Blank is Other; null means unreadable. */
export function parseMode(raw: string): string | null {
  const name = key(raw);
  if (!name) return "OTHER";
  const option = PAYMENT_METHOD_OPTIONS.find(
    (m) => key(m.value) === name || key(m.label) === name,
  );
  return option?.value ?? MODE_WORDS[name] ?? null;
}

/** The fee line a month's late fee goes on. */
export const LATE_FEE_LINE = "__late_fee__";

/** Where fees above the fee structure go, and old fees with no structure. */
export const OTHER_FEES_HEAD = "Other Fees";

/** A fee head and what the fee structure bills for it. */
export interface ExpectedLine {
  head: string;
  amount: number;
}

/**
 * Splits a month's total across its fee heads, using what the fee structure
 * expects. Anything less is a discount, taken off the fee heads in order;
 * anything more goes under Other Fees.
 */
export function splitFees(fees: number, expected: ExpectedLine[]) {
  const total = roundMoney(expected.reduce((sum, e) => sum + e.amount, 0));
  const lines = expected.map((e) => ({ ...e }));
  let toTakeOff = Math.max(0, roundMoney(total - fees));
  const discount = toTakeOff;
  for (const line of lines) {
    const off = Math.min(line.amount, toTakeOff);
    line.amount = roundMoney(line.amount - off);
    toTakeOff = roundMoney(toTakeOff - off);
  }
  const other = Math.max(0, roundMoney(fees - total));
  if (other > 0) lines.push({ head: OTHER_FEES_HEAD, amount: other });
  return { lines: lines.filter((l) => l.amount > 0), discount, other };
}

export interface HistoryBillLine {
  /** A fee head's name, or `LATE_FEE_LINE`. */
  head: string;
  amount: number;
  paid: number;
}

export interface HistoryBill {
  studentId: string;
  period: string;
  lines: HistoryBillLine[];
}

export interface HistoryPayment {
  studentId: string;
  /** Null when the month had none; the server then makes one up. */
  receiptNo: string | null;
  sheetRow: number;
  /** The month it was first seen on. */
  period: string;
  /** "YYYY-MM-DD" */
  date: string;
  method: string;
  amount: number;
  allocations: { period: string; head: string; amount: number }[];
  /** Paid beyond the bills: held as the student's advance. */
  advance: number;
}

export interface HistoryContext {
  students: ImportableStudent[];
  /** "studentId|YYYY-MM" for months already billed in the app. */
  billedMonths: ReadonlySet<string>;
  /** Student to the last month their opening balance covers. */
  openingMonths: ReadonlyMap<string, string>;
  /** "studentId|YYYY-MM" to what the fee structure bills that month. */
  expected: ReadonlyMap<string, ExpectedLine[]>;
  /** Receipt numbers in use, lowercased. */
  usedReceipts: ReadonlySet<string>;
  /** "YYYY-MM-DD", the school's date. */
  today: string;
  /** Set when blank late fees should be worked out from the school's rule. */
  lateFeeRule: LateFeeRule | null;
}

export interface HistoryTotals {
  bills: number;
  payments: number;
  billed: number;
  lateFees: number;
  /** Fees lowered below the fee structure. */
  discounts: number;
  /** Fees above the fee structure, or with no structure to follow. */
  otherFees: number;
  paid: number;
  dues: number;
  advance: number;
  /** Months left out: billed already, or inside an opening balance. */
  alreadyBilled: number;
  inOpeningBalance: number;
  /** Payments with no date, dated to the bill instead. */
  undatedPayments: number;
}

export interface HistoryPlan {
  bills: HistoryBill[];
  payments: HistoryPayment[];
  problems: string[];
  /** Fee heads the bills use. */
  heads: string[];
  /** Months the bills are for. */
  periods: string[];
  totals: HistoryTotals;
}

const monthProblem = (row: FeeHistoryRow, message: string) =>
  `Row ${row.sheetRow}, ${formatPeriodLabel(row.period)}: ${message}`;

const daysBetween = (from: string, to: string) =>
  Math.floor(
    (new Date(`${to}T00:00:00Z`).getTime() -
      new Date(`${from}T00:00:00Z`).getTime()) /
      86_400_000,
  );

type MonthRows = {
  student: ImportableStudent;
  period: string;
  rows: FeeHistoryRow[];
};

/** Checks the file's rows and works out the bills and payments they make. */
export function planFeeHistory(
  rows: FeeHistoryRow[],
  context: HistoryContext,
): HistoryPlan {
  const plan: HistoryPlan = {
    bills: [],
    payments: [],
    problems: [],
    heads: [],
    periods: [],
    totals: {
      bills: 0,
      payments: 0,
      billed: 0,
      lateFees: 0,
      discounts: 0,
      otherFees: 0,
      paid: 0,
      dues: 0,
      advance: 0,
      alreadyBilled: 0,
      inOpeningBalance: 0,
      undatedPayments: 0,
    },
  };
  const { totals } = plan;
  const rowProblem = (row: FeeHistoryRow, message: string) =>
    plan.problems.push(`Row ${row.sheetRow}: ${message}`);

  const byAdmission = new Map(
    context.students.map((s) => [s.admissionNumber.trim().toLowerCase(), s]),
  );
  const currentMonth = context.today.slice(0, 7);
  const months = new Map<string, MonthRows>();

  for (const row of rows) {
    const number = row.admissionNumber.trim();
    if (!number) {
      rowProblem(row, "Admission number is missing");
      continue;
    }
    const student = byAdmission.get(number.toLowerCase());
    if (!student) {
      rowProblem(
        row,
        `Admission number ${number} isn't a student at this school`,
      );
      continue;
    }
    if (!student.isActive) {
      rowProblem(row, `${student.name} (${number}) has left the school`);
      continue;
    }
    if (!isPeriodKey(row.period)) {
      rowProblem(row, `"${row.period}" isn't a month`);
      continue;
    }
    if (row.period > currentMonth) {
      rowProblem(row, `${formatPeriodLabel(row.period)} hasn't happened yet`);
      continue;
    }
    const id = `${student.id}|${row.period}`;
    const month = months.get(id);
    if (month) month.rows.push(row);
    else months.set(id, { student, period: row.period, rows: [row] });
  }

  const payments = new Map<string, HistoryPayment>();

  for (const [id, { student, period, rows: monthRows }] of months) {
    const covered = context.openingMonths.get(student.id);
    if (covered && period <= covered) {
      totals.inOpeningBalance++;
      continue;
    }
    if (context.billedMonths.has(id)) {
      totals.alreadyBilled++;
      continue;
    }

    const problemsBefore = plan.problems.length;
    const problem = (row: FeeHistoryRow, message: string) =>
      plan.problems.push(monthProblem(row, message));
    const amount = (row: FeeHistoryRow, value: string, name: string) => {
      const parsed = parseAmount(value);
      if ("error" in parsed) {
        problem(row, `${name} "${value}" isn't a valid amount`);
        return 0;
      }
      return parsed.amount;
    };

    let billRow: FeeHistoryRow | null = null;
    let fees = 0;
    let lateFee: number | null = null;

    for (const row of monthRows) {
      const rowFees = amount(row, row.fees, "Fees");
      const rowLate = row.lateFee ? amount(row, row.lateFee, "Late Fee") : null;
      if (!rowFees && !rowLate) continue;
      if (billRow) {
        problem(
          row,
          `${student.name} has fees for this month on two rows. Keep them on one`,
        );
        continue;
      }
      billRow = row;
      fees = rowFees;
      lateFee = rowLate;
    }

    // Payments for the month, in row order.
    const paidRows: {
      row: FeeHistoryRow;
      paid: number;
      date: string | null;
      method: string;
    }[] = [];
    for (const row of monthRows) {
      const paid = amount(row, row.paid, "Paid");
      if (paid <= 0) continue;
      const parsedDate = parseImportDate(row.paidOn);
      if (parsedDate.error) {
        problem(row, `Paid On "${row.paidOn}" isn't a valid date`);
        continue;
      }
      const method = parseMode(row.mode);
      if (!method) {
        problem(row, `Mode "${row.mode}" isn't one we know`);
        continue;
      }
      paidRows.push({
        row,
        paid,
        date: parsedDate.date?.toISOString().slice(0, 10) ?? null,
        method,
      });
    }
    if (plan.problems.length > problemsBefore) continue;

    const split =
      fees > 0
        ? splitFees(fees, context.expected.get(id) ?? [])
        : { lines: [], discount: 0, other: 0 };
    const lines: HistoryBillLine[] = split.lines.map((l) => ({
      ...l,
      paid: 0,
    }));
    const principal = roundMoney(lines.reduce((sum, l) => sum + l.amount, 0));

    // A late fee in the file stands as written; a blank one can come from
    // the school's rule: late until paid in full, or still late today.
    const dueDate = historyDueDate(period);
    if (lateFee === null && context.lateFeeRule && principal > 0) {
      const paidTotal = paidRows.reduce((sum, p) => sum + p.paid, 0);
      const lastPaid = paidRows
        .map((p) => p.date ?? dueDate)
        .sort()
        .at(-1);
      const settled =
        paidTotal >= principal ? (lastPaid ?? dueDate) : context.today;
      lateFee = calculateLateFee(
        context.lateFeeRule,
        daysBetween(dueDate, settled),
        principal,
      );
    }
    if (lateFee) lines.push({ head: LATE_FEE_LINE, amount: lateFee, paid: 0 });

    for (const { row, paid, date, method } of paidRows) {
      const receiptNo = row.receiptNo.trim();
      const receiptKey = receiptNo.toLowerCase();
      if (receiptKey && context.usedReceipts.has(receiptKey)) {
        problem(row, `Receipt ${receiptNo} is already in Kora`);
        continue;
      }
      // A row holds many months, so a blank receipt is one payment per month.
      const paymentKey = receiptKey || `row-${row.sheetRow}-${period}`;
      let payment = payments.get(paymentKey);
      if (payment && payment.studentId !== student.id) {
        problem(row, `Receipt ${receiptNo} is also used for another student`);
        continue;
      }
      if (!payment) {
        if (!date) totals.undatedPayments++;
        payment = {
          studentId: student.id,
          receiptNo: receiptNo || null,
          sheetRow: row.sheetRow,
          period,
          date: date ?? (dueDate < context.today ? dueDate : context.today),
          method,
          amount: 0,
          allocations: [],
          advance: 0,
        };
        payments.set(paymentKey, payment);
      }
      payment.amount = roundMoney(payment.amount + paid);

      let left = paid;
      for (const line of lines) {
        const take = Math.min(left, roundMoney(line.amount - line.paid));
        if (take <= 0) continue;
        line.paid = roundMoney(line.paid + take);
        left = roundMoney(left - take);
        payment.allocations.push({ period, head: line.head, amount: take });
      }
      payment.advance = roundMoney(payment.advance + left);
    }

    if (lines.length > 0) {
      plan.bills.push({ studentId: student.id, period, lines });
      totals.discounts = roundMoney(totals.discounts + split.discount);
      totals.otherFees = roundMoney(totals.otherFees + split.other);
    }
  }

  plan.payments = [...payments.values()];
  for (const bill of plan.bills) {
    for (const line of bill.lines) {
      totals.billed = roundMoney(totals.billed + line.amount);
      totals.dues = roundMoney(totals.dues + line.amount - line.paid);
      if (line.head === LATE_FEE_LINE) {
        totals.lateFees = roundMoney(totals.lateFees + line.amount);
      }
    }
  }
  for (const payment of plan.payments) {
    totals.paid = roundMoney(totals.paid + payment.amount);
    totals.advance = roundMoney(totals.advance + payment.advance);
  }
  totals.bills = plan.bills.length;
  totals.payments = plan.payments.length;
  plan.heads = [
    ...new Set(
      plan.bills.flatMap((b) =>
        b.lines.map((l) => l.head).filter((h) => h !== LATE_FEE_LINE),
      ),
    ),
  ];
  plan.periods = [...new Set(plan.bills.map((b) => b.period))].sort();
  // A row with a bad admission number says so once, not once per month.
  plan.problems = [...new Set(plan.problems)];
  return plan;
}

/**
 * Receipts used for two students. The server checks a batch at a time, and a
 * student's rows stay in one batch, so this one needs the whole file.
 */
export function findSharedReceipts(rows: FeeHistoryRow[]): string[] {
  const owner = new Map<string, string>();
  const problems: string[] = [];
  for (const row of rows) {
    const receipt = row.receiptNo.trim().toLowerCase();
    if (!receipt) continue;
    const student = row.admissionNumber.trim().toLowerCase();
    const first = owner.get(receipt);
    if (first && first !== student) {
      problems.push(
        monthProblem(
          row,
          `Receipt ${row.receiptNo.trim()} is also used for another student`,
        ),
      );
    } else {
      owner.set(receipt, student);
    }
  }
  return problems;
}

/** Splits rows into batches of about `size`, keeping each student's together. */
export function batchHistoryRows(
  rows: FeeHistoryRow[],
  size: number,
): FeeHistoryRow[][] {
  const byStudent = new Map<string, FeeHistoryRow[]>();
  for (const row of rows) {
    const student = row.admissionNumber.trim().toLowerCase();
    const list = byStudent.get(student);
    if (list) list.push(row);
    else byStudent.set(student, [row]);
  }
  const batches: FeeHistoryRow[][] = [];
  let batch: FeeHistoryRow[] = [];
  for (const list of byStudent.values()) {
    if (batch.length > 0 && batch.length + list.length > size) {
      batches.push(batch);
      batch = [];
    }
    batch.push(...list);
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

interface DatedSession {
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

/** The session a month falls in, the current one first if sessions overlap. */
export function findSessionForPeriod<T extends DatedSession>(
  period: string,
  sessions: T[],
): T | undefined {
  return [...sessions]
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
    .find((s) => isPeriodWithinSession(period, s.startDate, s.endDate));
}

/**
 * The year-long session a month belongs to when the school has none for it,
 * shaped like the current session: "2025-26" from April to March.
 */
export function pastSessionFor(period: string, currentStart: Date) {
  const startMonth = currentStart.getUTCMonth() + 1;
  const { year, month } = parsePeriodKey(period)!;
  const startYear = month >= startMonth ? year : year - 1;
  return {
    name: `${startYear}-${String(startYear + 1).slice(2)}`,
    startDate: new Date(Date.UTC(startYear, startMonth - 1, 1)),
    endDate: new Date(Date.UTC(startYear + 1, startMonth - 1, 0)),
  };
}
