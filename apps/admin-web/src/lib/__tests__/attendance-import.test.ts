import { describe, it, expect } from "vitest";
import {
  attendanceDayHeader,
  monthDates,
  parseAttendanceCell,
  planAttendanceImport,
  readAttendanceSheets,
  weekdayOf,
  type AttendanceContext,
  type AttendanceRow,
} from "../attendance-import";

const context = (over: Partial<AttendanceContext> = {}): AttendanceContext => ({
  students: [
    { id: "asha", admissionNumber: "ADM-1" },
    { id: "kabir", admissionNumber: "ADM-2" },
  ],
  sectionName: "Class 4 A",
  existing: new Set(),
  today: "2026-11-01",
  ...over,
});

let nextRow = 2;
const row = (
  marks: Record<string, string>,
  over: Partial<AttendanceRow> = {},
): AttendanceRow => ({
  period: "2026-04",
  sheetRow: nextRow++,
  admissionNumber: "ADM-1",
  marks,
  ...over,
});

describe("a cell", () => {
  it.each([
    ["P", "PRESENT"],
    ["p", "PRESENT"],
    [" present ", "PRESENT"],
    ["A", "ABSENT"],
    ["Absent", "ABSENT"],
    ["L", "LATE"],
    ["late", "LATE"],
    ["E", "EXCUSED"],
    ["Excused", "EXCUSED"],
    ["Leave", "EXCUSED"],
  ])("reads %j as %s", (raw, status) => {
    expect(parseAttendanceCell(raw)).toBe(status);
  });

  it("leaves a blank cell blank", () => {
    expect(parseAttendanceCell("  ")).toBe("");
  });

  it("doesn't guess at anything else", () => {
    for (const raw of ["X", "H", "1", "yes", "PP"]) {
      expect(parseAttendanceCell(raw), raw).toBeNull();
    }
  });
});

describe("the calendar", () => {
  it("heads a column with the day and weekday", () => {
    expect(attendanceDayHeader("2026-04-01")).toBe("1 Wed");
    expect(attendanceDayHeader("2026-04-05")).toBe("5 Sun");
    expect(weekdayOf("2026-04-05")).toBe("Sun");
  });

  it("lists a month's days, leap years included", () => {
    expect(monthDates("2026-04", "2026-11-01")).toHaveLength(30);
    expect(monthDates("2028-02", "2028-12-31")).toHaveLength(29);
  });

  it("offers no days still to come", () => {
    expect(monthDates("2026-11", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });
});

describe("reading a filled file", () => {
  const sheet = (name: string, rows: Record<string, unknown>[]) => ({
    name,
    headers: ["Admission No", "Student Name", "Roll No", "1 Wed", "2 Thu"],
    rows: rows.map((cells, i) => ({ cells, sheetRow: i + 2 })),
  });

  it("reads each month from its sheet's name", () => {
    const read = readAttendanceSheets([
      sheet("May 2026", [{ "Admission No": "ADM-1", "2 Thu": "A" }]),
      sheet("Apr 2026", [{ "Admission No": "ADM-1", "1 Wed": " P " }]),
    ]);
    expect(read?.months).toEqual(["2026-04", "2026-05"]);
    expect(read?.rows).toEqual([
      {
        period: "2026-05",
        sheetRow: 2,
        admissionNumber: "ADM-1",
        marks: { "2": "A" },
      },
      {
        period: "2026-04",
        sheetRow: 2,
        admissionNumber: "ADM-1",
        marks: { "1": "P" },
      },
    ]);
  });

  it("leaves other sheets alone", () => {
    const read = readAttendanceSheets([
      sheet("Apr 2026", [{ "Admission No": "ADM-1", "1 Wed": "P" }]),
      { name: "Instructions", headers: ["How to fill this file"], rows: [] },
    ]);
    expect(read?.months).toEqual(["2026-04"]);
  });

  it("reads a number in the admission column as text", () => {
    const read = readAttendanceSheets([
      sheet("Apr 2026", [{ "Admission No": 42, "1 Wed": "P" }]),
    ]);
    expect(read?.rows[0].admissionNumber).toBe("42");
  });

  it("keeps a student with nothing filled, for the dialog to drop", () => {
    const read = readAttendanceSheets([
      sheet("Apr 2026", [{ "Admission No": "ADM-1" }]),
    ]);
    expect(read?.rows[0].marks).toEqual({});
  });

  it("turns away files that aren't the template", () => {
    expect(
      readAttendanceSheets([
        { name: "Sheet1", headers: ["Name", "Phone"], rows: [] },
      ]),
    ).toBeNull();
    expect(
      readAttendanceSheets([
        { name: "Apr 2026", headers: ["Name", "1 Wed"], rows: [] },
      ]),
    ).toBeNull();
  });
});

describe("planning an import", () => {
  it("makes a record for each filled cell and counts them", () => {
    const { records, totals, problems } = planAttendanceImport(
      [
        row({ "1": "P", "2": "A", "3": "L" }),
        row({ "1": "E" }, { admissionNumber: "ADM-2" }),
      ],
      context(),
    );
    expect(problems).toEqual([]);
    expect(records).toContainEqual({
      studentId: "asha",
      date: "2026-04-02",
      status: "ABSENT",
    });
    expect(totals).toEqual({
      students: 2,
      days: 3,
      records: 4,
      present: 1,
      absent: 1,
      late: 1,
      excused: 1,
      alreadyInKora: 0,
    });
  });

  it("matches an admission number however it's cased", () => {
    const { problems } = planAttendanceImport(
      [row({ "1": "P" }, { admissionNumber: " adm-1 " })],
      context(),
    );
    expect(problems).toEqual([]);
  });

  it("skips what Kora already has, and says how much", () => {
    const { records, totals } = planAttendanceImport(
      [row({ "1": "A", "2": "A" })],
      context({ existing: new Set(["asha|2026-04-01"]) }),
    );
    expect(records.map((r) => r.date)).toEqual(["2026-04-02"]);
    expect(totals).toMatchObject({ records: 1, alreadyInKora: 1 });
  });

  describe("problems", () => {
    const problem = (r: AttendanceRow, ctx = context()) => {
      const { problems, records } = planAttendanceImport([r], ctx);
      expect(records).toEqual([]);
      return problems[0]?.replace(`row ${r.sheetRow}`, "row");
    };

    it("says where each one is", () => {
      expect(problem(row({ "3": "X" }))).toBe(
        'Apr 2026, row, day 3: "X" isn\'t P, A, L or E',
      );
      expect(problem(row({ "1": "P" }, { admissionNumber: "" }))).toBe(
        "Apr 2026, row: Admission number is missing",
      );
      expect(problem(row({ "1": "P" }, { admissionNumber: "NOPE" }))).toBe(
        "Apr 2026, row: Admission number NOPE isn't in Class 4 A",
      );
    });

    it("refuses a date that doesn't exist", () => {
      expect(problem(row({ "31": "P" }))).toBe(
        "Apr 2026, row, day 31: That date doesn't exist",
      );
    });

    it("refuses a day still to come", () => {
      expect(problem(row({ "2": "P" }, { period: "2026-11" }))).toBe(
        "Nov 2026, row, day 2: That day hasn't happened yet",
      );
    });

    it("allows today", () => {
      const { problems } = planAttendanceImport(
        [row({ "1": "P" }, { period: "2026-11" })],
        context(),
      );
      expect(problems).toEqual([]);
    });

    it("refuses a student marked twice for one day", () => {
      const second = row({ "1": "A" });
      const { problems } = planAttendanceImport(
        [row({ "1": "P" }), second],
        context(),
      );
      expect(problems).toEqual([
        `Apr 2026, row ${second.sheetRow}, day 1: ADM-1 appears twice`,
      ]);
    });

    it("ignores a blank cell", () => {
      const { problems, records } = planAttendanceImport(
        [row({ "1": "  " })],
        context(),
      );
      expect(problems).toEqual([]);
      expect(records).toEqual([]);
    });
  });
});
