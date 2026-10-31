/**
 * Opening balances: what each student owes or holds in advance on the day a
 * school starts using the app. The school fills a template of its own
 * students; only the admission number, dues and advance columns are read.
 * Pure functions, shared by the import dialog and the server.
 */

import { formatPeriodLabel, toPeriodKey } from "./billing-period";

/** The name of the fee head opening dues are billed under. */
export const PREVIOUS_DUES_HEAD = "Previous Dues";
export const PREVIOUS_DUES_CATEGORY = "PREVIOUS_DUES";

export const TEMPLATE_HEADERS = [
  "Admission Number",
  "Student Name",
  "Class",
  "Section",
  "Roll Number",
  "Parent Name",
  "Dues (₹)",
  "Advance (₹)",
];

export const TEMPLATE_INSTRUCTIONS = [
  "How to fill this file",
  "",
  "1. Type what each student owes today under Dues, and any extra money you hold for them under Advance.",
  "2. Leave both blank for a student who owes nothing and has no advance.",
  "3. Don't change the Admission Number column. The other filled columns are only there to help you find each student.",
  "4. A student has either dues or an advance, not both. If they have both, enter the difference.",
  "5. Save the file and upload it on the Fees page.",
];

const MAX_AMOUNT = 99_999_999.99; // what a fee item's amount can hold

const columnKey = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The headers of the three columns the import reads. `missing` names any
 * that aren't there, which means this isn't the template.
 */
export function findTemplateColumns(
  headers: string[],
):
  | { admissionNumber: string; dues: string; advance: string }
  | { missing: string[] } {
  const find = (key: string) => headers.find((h) => columnKey(h) === key);
  const admissionNumber = find("admissionnumber");
  const dues = find("dues");
  const advance = find("advance");
  if (admissionNumber && dues && advance) {
    return { admissionNumber, dues, advance };
  }
  return {
    missing: [
      ...(admissionNumber ? [] : ["Admission Number"]),
      ...(dues ? [] : ["Dues"]),
      ...(advance ? [] : ["Advance"]),
    ],
  };
}

/** An amount cell. Blank is 0; "₹4,500" and "Rs. 4500" are 4500. */
export function parseAmount(raw: string): { amount: number } | { error: true } {
  const clean = raw.replace(/₹|rs\.?|inr|,|\s/gi, "");
  if (clean === "") return { amount: 0 };
  if (!/^\d+(\.\d+)?$/.test(clean)) return { error: true };
  const amount = Math.round(Number(clean) * 100) / 100;
  return amount > MAX_AMOUNT ? { error: true } : { amount };
}

/** One filled row of the template, as read from the file. */
export interface OpeningBalanceRow {
  /** The row's line in the spreadsheet. */
  sheetRow: number;
  admissionNumber: string;
  dues: string;
  advance: string;
}

export interface ImportableStudent {
  id: string;
  admissionNumber: string;
  name: string;
  isActive: boolean;
}

export interface OpeningBalanceEntry {
  studentId: string;
  name: string;
  dues: number;
  advance: number;
}

export interface OpeningBalancePlan {
  /** Every student the import covers, those with nothing owed included. */
  entries: OpeningBalanceEntry[];
  /** Rows that must be fixed first, by row number. */
  problems: string[];
  /** Students left out because they already have an opening balance. */
  alreadyImported: number;
}

/** Checks the file's rows against the school's students. Changes nothing. */
export function planOpeningBalances(
  rows: OpeningBalanceRow[],
  students: ImportableStudent[],
  alreadyCovered: ReadonlySet<string>,
): OpeningBalancePlan {
  const byAdmission = new Map(
    students.map((s) => [s.admissionNumber.trim().toLowerCase(), s]),
  );
  const seen = new Set<string>();
  const plan: OpeningBalancePlan = {
    entries: [],
    problems: [],
    alreadyImported: 0,
  };

  for (const row of rows) {
    const number = row.admissionNumber.trim();
    const dues = parseAmount(row.dues);
    const advance = parseAmount(row.advance);
    const problem = (text: string) =>
      plan.problems.push(`Row ${row.sheetRow}: ${text}`);

    if (!number) {
      problem("Admission number is missing");
      continue;
    }
    const key = number.toLowerCase();
    const student = byAdmission.get(key);
    if (seen.has(key)) {
      problem(`Admission number ${number} appears more than once`);
      continue;
    }
    seen.add(key);
    if (!student) {
      problem(`Admission number ${number} isn't a student at this school`);
      continue;
    }
    if (!student.isActive) {
      problem(`${student.name} (${number}) has left the school`);
      continue;
    }
    if (alreadyCovered.has(student.id)) {
      plan.alreadyImported++;
      continue;
    }
    if ("error" in dues) {
      problem(`Dues "${row.dues.trim()}" isn't a valid amount`);
      continue;
    }
    if ("error" in advance) {
      problem(`Advance "${row.advance.trim()}" isn't a valid amount`);
      continue;
    }
    if (dues.amount > 0 && advance.amount > 0) {
      problem(
        `${student.name} has both dues and an advance. Enter only the difference`,
      );
      continue;
    }
    plan.entries.push({
      studentId: student.id,
      name: student.name,
      dues: dues.amount,
      advance: advance.amount,
    });
  }
  return plan;
}

export function planTotals(entries: OpeningBalanceEntry[]) {
  const sum = (pick: (e: OpeningBalanceEntry) => number) =>
    Math.round(entries.reduce((n, e) => n + pick(e), 0) * 100) / 100;
  return {
    students: entries.length,
    withDues: entries.filter((e) => e.dues > 0).length,
    withAdvance: entries.filter((e) => e.advance > 0).length,
    totalDues: sum((e) => e.dues),
    totalAdvance: sum((e) => e.advance),
  };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Why a "YYYY-MM-DD" can't be a balance date, or null if it can. */
export function asOfDateError(asOf: string, today: string): string | null {
  const parts = ISO_DATE.exec(asOf);
  const date = parts && new Date(`${asOf}T00:00:00Z`);
  if (
    !date ||
    Number.isNaN(date.getTime()) ||
    !date.toISOString().startsWith(asOf)
  ) {
    return "Choose the date these balances are for";
  }
  return asOf > today ? "The balance date can't be in the future" : null;
}

/** "1 Oct 2026" for "2026-10-01". */
export function formatAsOfDate(asOf: string): string {
  return new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The first month the app bills: "November 2026" for "2026-10-01". */
export function firstBilledMonth(asOf: string): string {
  const [year, month] = asOf.split("-").map(Number);
  return formatPeriodLabel(
    month === 12 ? toPeriodKey(year + 1, 1) : toPeriodKey(year, month + 1),
  );
}
