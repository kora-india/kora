/**
 * Past attendance, brought in one section at a time from a filled template: a
 * sheet per month, a row per student and a column per day, like a paper
 * register. Pure functions, shared by the import dialog and the server.
 */

import { monthLabel, parseMonth } from "./fees/fee-history";
import { isIsoDate } from "./reports/ledger-query";

export const ATTENDANCE_STUDENT_HEADERS = [
  "Admission No",
  "Student Name",
  "Roll No",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ATTENDANCE_TEMPLATE_INSTRUCTIONS = [
  "How to fill this file",
  "",
  "There is one sheet for each month, one row for each student and one column for each day.",
  "1. Type P for Present, A for Absent, L for Late or E for Excused.",
  "2. Leave a cell blank if that day wasn't recorded. Holidays and grey days stay blank.",
  "3. Days already marked in Kora stay as they are, so the file can't overwrite them.",
  "4. Don't change the sheet names or the Admission No column.",
  "5. Save the file as Excel (.xlsx) and upload it where you downloaded it.",
];

const STATUS_WORDS: Record<string, AttendanceStatus> = {
  P: "PRESENT",
  PRESENT: "PRESENT",
  A: "ABSENT",
  ABSENT: "ABSENT",
  L: "LATE",
  LATE: "LATE",
  E: "EXCUSED",
  EXCUSED: "EXCUSED",
  LEAVE: "EXCUSED",
};

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

/** A cell as a status. Blank is "", anything unreadable null. */
export function parseAttendanceCell(raw: string): AttendanceStatus | "" | null {
  const value = raw.trim().toUpperCase();
  if (!value) return "";
  return STATUS_WORDS[value] ?? null;
}

/** "2026-04-01": "1 Wed" */
export function attendanceDayHeader(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  return `${day.getUTCDate()} ${WEEKDAYS[day.getUTCDay()]}`;
}

/** The weekday a date falls on, as `School.workingDays` writes it. */
export const weekdayOf = (date: string) =>
  WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** Each date of a month up to `today`, so the template offers no future days. */
export function monthDates(period: string, today: string) {
  const [year, month] = period.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`,
  ).filter((date) => date <= today);
}

export const attendanceSheetName = monthLabel;

/** One student's row on one month's sheet, as filled in. */
export interface AttendanceRow {
  /** "YYYY-MM" */
  period: string;
  sheetRow: number;
  admissionNumber: string;
  /** Day of the month to what the cell says; blank days are left out. */
  marks: Record<string, string>;
}

interface Sheet {
  name: string;
  headers: string[];
  rows: { cells: Record<string, unknown>; sheetRow: number }[];
}

const cellText = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).trim();

/**
 * The rows of a filled template. A sheet named for a month is a month's
 * register; any other sheet, like Instructions, is left alone. null means the
 * file isn't the template.
 */
export function readAttendanceSheets(sheets: Sheet[]) {
  const rows: AttendanceRow[] = [];
  const months: string[] = [];
  for (const sheet of sheets) {
    const period = parseMonth(sheet.name);
    if (!period) continue;
    const admission = sheet.headers.find(
      (h) => h.toLowerCase().replace(/[^a-z]/g, "") === "admissionno",
    );
    if (!admission) return null;
    months.push(period);
    const days = sheet.headers.flatMap((header) => {
      const day = /^(\d{1,2})(\s|$)/.exec(header.trim())?.[1];
      return day ? [{ header, day: String(Number(day)) }] : [];
    });
    for (const { cells, sheetRow } of sheet.rows) {
      const marks: Record<string, string> = {};
      for (const { header, day } of days) {
        const value = cellText(cells[header]);
        if (value) marks[day] = value;
      }
      const admissionNumber = cellText(cells[admission]);
      if (admissionNumber || Object.keys(marks).length > 0) {
        rows.push({ period, sheetRow, admissionNumber, marks });
      }
    }
  }
  return months.length > 0 ? { rows, months: months.sort() } : null;
}

export interface AttendanceTotals {
  students: number;
  days: number;
  records: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Days the file has that are already marked in Kora. */
  alreadyInKora: number;
}

export interface AttendanceContext {
  /** Who's in the section. */
  students: { id: string; admissionNumber: string }[];
  /** The section, for messages. */
  sectionName: string;
  /** "studentId|YYYY-MM-DD" for days already marked. */
  existing: ReadonlySet<string>;
  /** "YYYY-MM-DD", the school's date. */
  today: string;
}

/** Checks the file's rows and works out the records they make. */
export function planAttendanceImport(
  rows: AttendanceRow[],
  context: AttendanceContext,
) {
  const problems: string[] = [];
  const records: {
    studentId: string;
    date: string;
    status: AttendanceStatus;
  }[] = [];
  const totals: AttendanceTotals = {
    students: 0,
    days: 0,
    records: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    alreadyInKora: 0,
  };
  const byAdmission = new Map(
    context.students.map((s) => [s.admissionNumber.trim().toLowerCase(), s]),
  );
  const seen = new Set<string>();
  const students = new Set<string>();
  const days = new Set<string>();

  for (const row of rows) {
    const where = `${attendanceSheetName(row.period)}, row ${row.sheetRow}`;
    const number = row.admissionNumber.trim();
    if (!number) {
      problems.push(`${where}: Admission number is missing`);
      continue;
    }
    const student = byAdmission.get(number.toLowerCase());
    if (!student) {
      problems.push(
        `${where}: Admission number ${number} isn't in ${context.sectionName}`,
      );
      continue;
    }
    for (const [day, raw] of Object.entries(row.marks)) {
      const date = `${row.period}-${day.padStart(2, "0")}`;
      const status = parseAttendanceCell(raw);
      if (status === "") continue;
      if (status === null) {
        problems.push(`${where}, day ${day}: "${raw}" isn't P, A, L or E`);
        continue;
      }
      if (!isIsoDate(date)) {
        problems.push(`${where}, day ${day}: That date doesn't exist`);
        continue;
      }
      if (date > context.today) {
        problems.push(`${where}, day ${day}: That day hasn't happened yet`);
        continue;
      }
      const id = `${student.id}|${date}`;
      if (seen.has(id)) {
        problems.push(`${where}, day ${day}: ${number} appears twice`);
        continue;
      }
      seen.add(id);
      if (context.existing.has(id)) {
        totals.alreadyInKora++;
        continue;
      }
      records.push({ studentId: student.id, date, status });
      students.add(student.id);
      days.add(date);
      totals[status.toLowerCase() as Lowercase<AttendanceStatus>]++;
    }
  }

  totals.records = records.length;
  totals.students = students.size;
  totals.days = days.size;
  return { records, totals, problems };
}
