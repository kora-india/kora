import { describe, it, expect } from "vitest";
import {
  asOfDateError,
  findTemplateColumns,
  firstBilledMonth,
  formatAsOfDate,
  parseAmount,
  planOpeningBalances,
  planTotals,
  TEMPLATE_HEADERS,
  type OpeningBalanceRow,
} from "../fees/opening-balance";

const students = [
  { id: "1", admissionNumber: "BCS-0001", name: "Tanvi", isActive: true },
  { id: "2", admissionNumber: "BCS-0002", name: "Anika", isActive: true },
  { id: "3", admissionNumber: "BCS-0003", name: "Yash", isActive: true },
  { id: "4", admissionNumber: "BCS-0004", name: "Left", isActive: false },
];

const row = (
  sheetRow: number,
  admissionNumber: string,
  dues = "",
  advance = "",
): OpeningBalanceRow => ({ sheetRow, admissionNumber, dues, advance });

describe("findTemplateColumns", () => {
  it("finds the columns of the template", () => {
    expect(findTemplateColumns(TEMPLATE_HEADERS)).toEqual({
      admissionNumber: "Admission Number",
      dues: "Dues (₹)",
      advance: "Advance (₹)",
    });
  });

  it("survives a re-saved file losing the ₹ sign", () => {
    expect(
      findTemplateColumns(["admission number", "Dues ()", "ADVANCE"]),
    ).toEqual({
      admissionNumber: "admission number",
      dues: "Dues ()",
      advance: "ADVANCE",
    });
  });

  it("says which columns a different file lacks", () => {
    expect(findTemplateColumns(["Full Name", "Dues"])).toEqual({
      missing: ["Admission Number", "Advance"],
    });
  });
});

describe("parseAmount", () => {
  it("reads the ways people write amounts", () => {
    for (const [raw, amount] of [
      ["", 0],
      ["  ", 0],
      ["4500", 4500],
      ["4,500", 4500],
      ["₹4,500.50", 4500.5],
      ["Rs. 4500", 4500],
      ["1234.5600000001", 1234.56],
    ] as const) {
      expect(parseAmount(raw), raw).toEqual({ amount });
    }
  });

  it("refuses anything that isn't a positive amount", () => {
    for (const raw of ["-500", "abc", "12 months", "1.2.3", "100000000"]) {
      expect(parseAmount(raw), raw).toEqual({ error: true });
    }
  });
});

describe("planOpeningBalances", () => {
  it("covers every listed student, blank rows included", () => {
    const plan = planOpeningBalances(
      [
        row(2, "BCS-0001", "4,500"),
        row(3, "bcs-0002", "", "1000"),
        row(4, "BCS-0003"),
      ],
      students,
      new Set(),
    );
    expect(plan.problems).toEqual([]);
    expect(plan.entries).toEqual([
      { studentId: "1", name: "Tanvi", dues: 4500, advance: 0 },
      { studentId: "2", name: "Anika", dues: 0, advance: 1000 },
      { studentId: "3", name: "Yash", dues: 0, advance: 0 },
    ]);
    expect(planTotals(plan.entries)).toEqual({
      students: 3,
      withDues: 1,
      withAdvance: 1,
      totalDues: 4500,
      totalAdvance: 1000,
    });
  });

  it("names each row's problem by its row number", () => {
    const plan = planOpeningBalances(
      [
        row(2, "", "100"),
        row(3, "NOPE-1", "100"),
        row(4, "BCS-0004", "100"),
        row(5, "BCS-0001", "abc"),
        row(6, "BCS-0002", "", "-5"),
        row(7, "BCS-0003", "100", "50"),
        row(8, "bcs-0003", "100"),
      ],
      students,
      new Set(),
    );
    expect(plan.entries).toEqual([]);
    expect(plan.problems).toEqual([
      "Row 2: Admission number is missing",
      "Row 3: Admission number NOPE-1 isn't a student at this school",
      "Row 4: Left (BCS-0004) has left the school",
      'Row 5: Dues "abc" isn\'t a valid amount',
      'Row 6: Advance "-5" isn\'t a valid amount',
      "Row 7: Yash has both dues and an advance. Enter only the difference",
      "Row 8: Admission number bcs-0003 appears more than once",
    ]);
  });

  it("leaves out students who already have an opening balance", () => {
    const plan = planOpeningBalances(
      [row(2, "BCS-0001", "4500"), row(3, "BCS-0002", "100")],
      students,
      new Set(["1"]),
    );
    expect(plan.alreadyImported).toBe(1);
    expect(plan.entries.map((e) => e.studentId)).toEqual(["2"]);
  });
});

describe("balance dates", () => {
  it("refuses dates that aren't real or haven't happened", () => {
    expect(asOfDateError("2026-10-01", "2026-10-31")).toBeNull();
    expect(asOfDateError("2026-10-31", "2026-10-31")).toBeNull();
    expect(asOfDateError("2026-11-01", "2026-10-31")).toMatch(/future/);
    expect(asOfDateError("2026-02-30", "2026-10-31")).toMatch(/Choose/);
    expect(asOfDateError("", "2026-10-31")).toMatch(/Choose/);
  });

  it("bills from the month after the balance date", () => {
    expect(firstBilledMonth("2026-10-01")).toBe("November 2026");
    expect(firstBilledMonth("2026-09-30")).toBe("October 2026");
    expect(firstBilledMonth("2026-12-15")).toBe("January 2027");
  });

  it("formats a balance date", () => {
    expect(formatAsOfDate("2026-10-01")).toBe("1 Oct 2026");
  });
});
