import { describe, it, expect } from "vitest";
import {
  LATE_FEE_LINE,
  OTHER_FEES_HEAD,
  batchHistoryRows,
  findHistoryColumns,
  findSessionForPeriod,
  findSharedReceipts,
  STUDENT_TEMPLATE_HEADERS,
  historyHeaders,
  monthLabel,
  monthsBetween,
  parseMode,
  parseMonth,
  pastSessionFor,
  planFeeHistory,
  splitFees,
  studentHistoryHeaders,
  toHistoryRows,
  toStudentRows,
  type ExpectedLine,
  type FeeHistoryRow,
  type HistoryColumns,
  type HistoryContext,
} from "../fees/fee-history";
import {
  guessColumnMapping,
  importFieldForHeader,
} from "../student-import-helpers";

const students = [
  { id: "asha", admissionNumber: "ADM-1", name: "Asha", isActive: true },
  { id: "kabir", admissionNumber: "ADM-2", name: "Kabir", isActive: true },
  { id: "left", admissionNumber: "ADM-3", name: "Left", isActive: false },
];

/** The fee structure: the same lines every month, for everyone. */
const structure = (expected: ExpectedLine[]) =>
  new Map(
    ["asha", "kabir"].flatMap((id) =>
      monthsBetween("2025-04", "2026-12").map(
        (period) => [`${id}|${period}`, expected] as const,
      ),
    ),
  );

const context = (over: Partial<HistoryContext> = {}): HistoryContext => ({
  students,
  billedMonths: new Set(),
  openingMonths: new Map(),
  expected: structure([{ head: "Tuition", amount: 1000 }]),
  usedReceipts: new Set(),
  today: "2026-10-31",
  lateFeeRule: null,
  ...over,
});

const rule = {
  lateFeeAmount: 100,
  lateFeeFrequency: "MONTHLY",
  maxLateFeeCap: null,
};

let nextRow = 2;
const row = (over: Partial<FeeHistoryRow> = {}): FeeHistoryRow => ({
  sheetRow: nextRow++,
  admissionNumber: "ADM-1",
  period: "2026-04",
  fees: "1000",
  heads: {},
  lateFee: "",
  paid: "",
  paidOn: "",
  mode: "",
  receiptNo: "",
  ...over,
});

const lines = (plan: ReturnType<typeof planFeeHistory>) =>
  plan.bills.flatMap((b) => b.lines);

describe("template columns", () => {
  const headers = historyHeaders(["2026-04", "2026-05"]);

  it("has the student, then six columns for each month", () => {
    expect(headers).toHaveLength(16);
    expect(headers.slice(0, 10)).toEqual([
      "Admission Number",
      "Student Name",
      "Class",
      "Section",
      "Apr 2026 Fees (₹)",
      "Apr 2026 Late Fee (₹)",
      "Apr 2026 Paid (₹)",
      "Apr 2026 Paid On",
      "Apr 2026 Mode",
      "Apr 2026 Receipt",
    ]);
    expect(headers[10]).toBe("May 2026 Fees (₹)");
  });

  it("finds each month's columns, oldest first", () => {
    const columns = findHistoryColumns(
      [...headers].reverse(),
    ) as HistoryColumns;
    expect(columns.admissionNumber).toBe("Admission Number");
    expect(columns.months.map((m) => m.period)).toEqual(["2026-04", "2026-05"]);
    expect(columns.months[0]).toEqual({
      period: "2026-04",
      heads: [],
      fees: "Apr 2026 Fees (₹)",
      lateFee: "Apr 2026 Late Fee (₹)",
      paid: "Apr 2026 Paid (₹)",
      paidOn: "Apr 2026 Paid On",
      mode: "Apr 2026 Mode",
      receiptNo: "Apr 2026 Receipt",
    });
  });

  it("reads a month however it's been written", () => {
    const columns = findHistoryColumns([
      "admission number",
      "September 2026 fees",
      "09/2026 PAID ON",
      "Sept-26 Receipt No",
    ]) as HistoryColumns;
    expect(columns.months).toEqual([
      {
        period: "2026-09",
        heads: [],
        fees: "September 2026 fees",
        paidOn: "09/2026 PAID ON",
        receiptNo: "Sept-26 Receipt No",
      },
    ]);
  });

  it("ignores columns that aren't a month's", () => {
    const columns = findHistoryColumns([
      "Admission Number",
      "Notes",
      "Bus Fees",
      "Apr 2026 Fees (₹)",
    ]) as HistoryColumns;
    expect(columns.months).toHaveLength(1);
  });

  it("says what a different file lacks", () => {
    expect(findHistoryColumns(["Full Name", "Paid"])).toEqual({
      missing: ["Admission Number column", "month columns"],
    });
    expect(findHistoryColumns(["Admission Number", "Month", "Paid"])).toEqual({
      missing: ["month columns"],
    });
  });

  it("makes a row for each month with anything in it", () => {
    const columns = findHistoryColumns(headers) as HistoryColumns;
    const cells = {
      "Admission Number": " ADM-1 ",
      "Apr 2026 Fees (₹)": 1000,
      "Apr 2026 Paid (₹)": 1000,
      "Apr 2026 Paid On": "05/04/2026",
      "Apr 2026 Mode": "Cash",
      "Apr 2026 Receipt": 42,
      "May 2026 Fees (₹)": "",
    };
    expect(toHistoryRows(cells, 7, columns)).toEqual([
      {
        sheetRow: 7,
        admissionNumber: "ADM-1",
        period: "2026-04",
        fees: "1000",
        heads: {},
        lateFee: "",
        paid: "1000",
        paidOn: "05/04/2026",
        mode: "Cash",
        receiptNo: "42",
      },
    ]);
  });

  it("makes a row for a month with only a payment or a late fee", () => {
    const columns = findHistoryColumns(headers) as HistoryColumns;
    expect(
      toHistoryRows(
        {
          "Admission Number": "ADM-1",
          "Apr 2026 Late Fee (₹)": 50,
          "May 2026 Paid (₹)": 500,
        },
        8,
        columns,
      ).map((r) => r.period),
    ).toEqual(["2026-04", "2026-05"]);
  });

  it("makes no rows for a student with nothing filled in", () => {
    const columns = findHistoryColumns(headers) as HistoryColumns;
    expect(toHistoryRows({ "Admission Number": "ADM-1" }, 9, columns)).toEqual(
      [],
    );
  });

  it("names months the short way", () => {
    expect(monthLabel("2026-04")).toBe("Apr 2026");
    expect(monthLabel("2026-09")).toBe("Sep 2026");
  });
});

describe("blank template columns", () => {
  const headers = studentHistoryHeaders(
    ["2026-04", "2026-05"],
    ["Tuition Fee", "Examination Fees"],
  );
  const columns = findHistoryColumns(headers) as HistoryColumns;

  it("has the student, then each fee head and the rest for each month", () => {
    expect(headers.slice(0, 2)).toEqual(["Admission Number", "Student Name"]);
    expect(headers).toHaveLength(15 + 2 * 7);
    expect(headers.slice(15, 22)).toEqual([
      "Apr 2026 Tuition Fee (₹)",
      "Apr 2026 Examination Fees (₹)",
      "Apr 2026 Late Fee (₹)",
      "Apr 2026 Paid (₹)",
      "Apr 2026 Paid On",
      "Apr 2026 Mode",
      "Apr 2026 Receipt",
    ]);
  });

  it("names every student column the way the student import reads it", () => {
    for (const header of STUDENT_TEMPLATE_HEADERS) {
      expect(importFieldForHeader(header), header).not.toBeNull();
    }
    expect(
      new Set(Object.values(guessColumnMapping(STUDENT_TEMPLATE_HEADERS))).size,
    ).toBe(STUDENT_TEMPLATE_HEADERS.length);
  });

  it("reads each fee head as a head of that month", () => {
    expect(columns.months[0]).toMatchObject({
      period: "2026-04",
      lateFee: "Apr 2026 Late Fee (₹)",
      heads: [
        { header: "Apr 2026 Tuition Fee (₹)", name: "Tuition Fee" },
        { header: "Apr 2026 Examination Fees (₹)", name: "Examination Fees" },
      ],
    });
    expect(columns.months[0].fees).toBeUndefined();
  });

  it("treats a month column it doesn't know as a fee head", () => {
    const found = findHistoryColumns([
      "Admission Number",
      "Apr 2026 Bus Charge",
    ]) as HistoryColumns;
    expect(found.months[0].heads).toEqual([
      { header: "Apr 2026 Bus Charge", name: "Bus Charge" },
    ]);
  });

  it("keeps a month's filled fee heads, and counts a head on its own", () => {
    const rows = toHistoryRows(
      {
        "Admission Number": "ADM-1",
        "Apr 2026 Tuition Fee (₹)": 1000,
        "Apr 2026 Examination Fees (₹)": "",
      },
      5,
      columns,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].heads).toEqual({ "Tuition Fee": "1000" });
  });

  describe("toStudentRows", () => {
    const student = {
      "Admission Number": "ADM-1",
      "Student Name": "Asha",
      Class: "Class 5",
      Section: "A",
      "Parent Name": "Ravi",
      "Parent Phone": 9000000000,
      Gender: "F",
    };

    it("reads a student, leaving the months out", () => {
      expect(
        toStudentRows(
          [
            {
              sheetRow: 2,
              cells: { ...student, "Apr 2026 Tuition Fee (₹)": 1000 },
            },
          ],
          columns,
        ),
      ).toEqual([
        {
          admissionNumber: "ADM-1",
          name: "Asha",
          classId: "Class 5",
          sectionId: "A",
          parentName: "Ravi",
          parentPhone: "9000000000",
          gender: "FEMALE",
          sheetRow: 2,
        },
      ]);
    });

    it("doesn't take a second payment's row for a student", () => {
      expect(
        toStudentRows(
          [
            {
              sheetRow: 3,
              cells: {
                "Admission Number": "ADM-1",
                "Apr 2026 Paid (₹)": 500,
              },
            },
          ],
          columns,
        ),
      ).toEqual([]);
    });

    it("keeps a row missing its name, so the check can say so", () => {
      const rows = toStudentRows(
        [
          {
            sheetRow: 4,
            cells: {
              "Admission Number": "ADM-1",
              "Parent Name": "Ravi",
              "Apr 2026 Paid (₹)": 500,
            },
          },
          { sheetRow: 5, cells: { "Admission Number": "ADM-2" } },
        ],
        columns,
      );
      expect(rows.map((r) => r.sheetRow)).toEqual([4, 5]);
    });
  });
});

describe("splitFees", () => {
  const expected = [
    { head: "Annual", amount: 3000 },
    { head: "Tuition", amount: 1000 },
  ];

  it("follows the fee structure when the total matches", () => {
    expect(splitFees(4000, expected)).toEqual({
      lines: expected,
      discount: 0,
      other: 0,
    });
  });

  it("takes a lower total off the fee heads in order", () => {
    expect(splitFees(3500, expected)).toEqual({
      lines: [
        { head: "Annual", amount: 2500 },
        { head: "Tuition", amount: 1000 },
      ],
      discount: 500,
      other: 0,
    });
    expect(splitFees(800, expected)).toEqual({
      lines: [{ head: "Tuition", amount: 800 }],
      discount: 3200,
      other: 0,
    });
  });

  it("puts anything above the structure under Other Fees", () => {
    expect(splitFees(4250.5, expected)).toEqual({
      lines: [...expected, { head: OTHER_FEES_HEAD, amount: 250.5 }],
      discount: 0,
      other: 250.5,
    });
  });

  it("puts everything under Other Fees when there's no structure", () => {
    expect(splitFees(900, [])).toEqual({
      lines: [{ head: OTHER_FEES_HEAD, amount: 900 }],
      discount: 0,
      other: 900,
    });
  });

  it("leaves the fee structure's lines as they are", () => {
    splitFees(100, expected);
    expect(expected[0].amount).toBe(3000);
  });
});

describe("parseMonth", () => {
  it("reads the ways a month gets written", () => {
    for (const raw of [
      "Apr 2026",
      "April 2026",
      "apr-26",
      "Apr-2026",
      "04/2026",
      "4-2026",
      "2026-04",
      "01/04/2026",
      "1-Apr-26",
      "46113", // what Excel stores for 1 Apr 2026
    ]) {
      expect(parseMonth(raw), raw).toBe("2026-04");
    }
    expect(parseMonth("Sept 2026")).toBe("2026-09");
  });

  it("refuses what isn't a month", () => {
    for (const raw of ["", "Spring 2026", "13/2026", "Apr", "2026"]) {
      expect(parseMonth(raw), raw).toBeNull();
    }
  });
});

describe("monthsBetween", () => {
  it("lists months across a year end", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("parseMode", () => {
  it("reads payment modes, blank as Other", () => {
    expect(parseMode("")).toBe("OTHER");
    expect(parseMode("Cash")).toBe("CASH");
    expect(parseMode("upi")).toBe("UPI");
    expect(parseMode("GPay")).toBe("UPI");
    expect(parseMode("Bank transfer")).toBe("BANK_TRANSFER");
    expect(parseMode("Bank")).toBe("BANK_TRANSFER");
    expect(parseMode("NEFT")).toBe("NEFT");
    expect(parseMode("Check")).toBe("CHEQUE");
    expect(parseMode("Card")).toBe("DEBIT_CARD");
  });

  it("doesn't guess at anything else", () => {
    expect(parseMode("Barter")).toBeNull();
  });
});

describe("planFeeHistory", () => {
  describe("bills and payments", () => {
    it("makes a paid month", () => {
      const plan = planFeeHistory(
        [
          row({
            paid: "1000",
            paidOn: "05/04/2026",
            mode: "UPI",
            receiptNo: "R-1",
          }),
        ],
        context(),
      );
      expect(plan.problems).toEqual([]);
      expect(plan.bills).toEqual([
        {
          studentId: "asha",
          period: "2026-04",
          lines: [{ head: "Tuition", amount: 1000, paid: 1000 }],
        },
      ]);
      expect(plan.payments).toEqual([
        expect.objectContaining({
          studentId: "asha",
          receiptNo: "R-1",
          date: "2026-04-05",
          method: "UPI",
          amount: 1000,
          advance: 0,
          allocations: [{ period: "2026-04", head: "Tuition", amount: 1000 }],
        }),
      ]);
      expect(plan.totals).toMatchObject({
        bills: 1,
        payments: 1,
        billed: 1000,
        paid: 1000,
        dues: 0,
      });
    });

    it("leaves an unpaid month owing", () => {
      const plan = planFeeHistory([row()], context());
      expect(plan.payments).toEqual([]);
      expect(plan.totals).toMatchObject({ billed: 1000, paid: 0, dues: 1000 });
    });

    it("pays fee heads in order", () => {
      const plan = planFeeHistory(
        [row({ fees: "1500", paid: "1200", paidOn: "05/04/2026" })],
        context({
          expected: structure([
            { head: "Tuition", amount: 1000 },
            { head: "Transport", amount: 500 },
          ]),
        }),
      );
      expect(lines(plan)).toEqual([
        { head: "Tuition", amount: 1000, paid: 1000 },
        { head: "Transport", amount: 500, paid: 200 },
      ]);
      expect(plan.totals.dues).toBe(300);
    });

    it("joins months paid on one receipt into one payment", () => {
      const plan = planFeeHistory(
        [
          row({ paid: "1000", paidOn: "05/05/2026", receiptNo: "R-7" }),
          row({
            period: "2026-05",
            paid: "1000",
            paidOn: "05/05/2026",
            receiptNo: "r-7",
          }),
        ],
        context(),
      );
      expect(plan.bills).toHaveLength(2);
      expect(plan.payments).toHaveLength(1);
      expect(plan.payments[0].amount).toBe(2000);
      expect(plan.payments[0].allocations).toHaveLength(2);
    });

    it("takes a second payment on a row of its own", () => {
      const plan = planFeeHistory(
        [
          row({ paid: "400", paidOn: "05/04/2026", receiptNo: "R-1" }),
          row({
            fees: "",
            paid: "600",
            paidOn: "20/04/2026",
            receiptNo: "R-2",
          }),
        ],
        context(),
      );
      expect(plan.problems).toEqual([]);
      expect(plan.bills).toHaveLength(1);
      expect(lines(plan)[0]).toMatchObject({ amount: 1000, paid: 1000 });
      expect(plan.payments.map((p) => p.amount)).toEqual([400, 600]);
    });

    it("makes a payment for each month of a row with no receipts", () => {
      const sheetRow = nextRow++;
      const paid = { sheetRow, paid: "1000", paidOn: "05/06/2026" };
      const plan = planFeeHistory(
        [row(paid), row({ ...paid, period: "2026-05" })],
        context(),
      );
      expect(plan.payments.map((p) => p.period)).toEqual([
        "2026-04",
        "2026-05",
      ]);
    });

    it("makes up no receipt number, leaving that to the server", () => {
      const plan = planFeeHistory(
        [row({ paid: "1000", paidOn: "05/04/2026" })],
        context(),
      );
      expect(plan.payments[0].receiptNo).toBeNull();
    });
  });

  describe("advances", () => {
    it("holds what was paid beyond the bill", () => {
      const plan = planFeeHistory(
        [row({ paid: "1500", paidOn: "05/04/2026" })],
        context(),
      );
      expect(lines(plan)[0].paid).toBe(1000);
      expect(plan.payments[0]).toMatchObject({ amount: 1500, advance: 500 });
      expect(plan.totals).toMatchObject({ paid: 1500, dues: 0, advance: 500 });
    });

    it("holds a payment with no bill", () => {
      const plan = planFeeHistory(
        [row({ fees: "", paid: "800", paidOn: "05/04/2026" })],
        context(),
      );
      expect(plan.bills).toEqual([]);
      expect(plan.payments[0]).toMatchObject({ amount: 800, advance: 800 });
    });
  });

  describe("late fees", () => {
    it("keeps the Late Fee column as written, month by month", () => {
      const plan = planFeeHistory(
        [
          row({ lateFee: "150" }),
          row({ period: "2026-05", lateFee: "75" }),
          row({ period: "2026-06" }),
        ],
        context(),
      );
      expect(
        plan.bills.map((b) => [
          b.period,
          b.lines.find((l) => l.head === LATE_FEE_LINE)?.amount,
        ]),
      ).toEqual([
        ["2026-04", 150],
        ["2026-05", 75],
        ["2026-06", undefined],
      ]);
      expect(plan.totals).toMatchObject({ lateFees: 225, dues: 3225 });
    });

    it("pays the fees first, then the late fee", () => {
      const plan = planFeeHistory(
        [row({ lateFee: "150", paid: "1100", paidOn: "05/05/2026" })],
        context(),
      );
      expect(lines(plan)).toEqual([
        { head: "Tuition", amount: 1000, paid: 1000 },
        { head: LATE_FEE_LINE, amount: 150, paid: 100 },
      ]);
      expect(plan.totals.dues).toBe(50);
    });

    it("bills a late fee on its own", () => {
      const plan = planFeeHistory(
        [row({ fees: "", lateFee: "150" })],
        context(),
      );
      expect(lines(plan)).toEqual([
        { head: LATE_FEE_LINE, amount: 150, paid: 0 },
      ]);
    });

    describe("from the school's rule", () => {
      const withRule = context({ lateFeeRule: rule });

      it("charges a month paid after the 10th", () => {
        const plan = planFeeHistory(
          [row({ paid: "1000", paidOn: "20/04/2026" })],
          withRule,
        );
        expect(plan.totals.lateFees).toBe(100);
        expect(plan.totals.dues).toBe(100);
      });

      it("charges nothing for a month paid on time", () => {
        const plan = planFeeHistory(
          [row({ paid: "1000", paidOn: "10/04/2026" })],
          withRule,
        );
        expect(plan.totals.lateFees).toBe(0);
      });

      it("counts an unpaid month up to today", () => {
        const plan = planFeeHistory([row()], withRule);
        expect(plan.totals.lateFees).toBe(300); // three months at most
      });

      it("counts to the last payment when it took two", () => {
        const plan = planFeeHistory(
          [
            row({ paid: "500", paidOn: "05/04/2026" }),
            row({ fees: "", paid: "500", paidOn: "15/06/2026" }),
          ],
          withRule,
        );
        expect(plan.totals.lateFees).toBe(300);
      });

      it("never overrides a late fee in the file, even 0", () => {
        const plan = planFeeHistory(
          [row({ lateFee: "40" }), row({ period: "2026-05", lateFee: "0" })],
          withRule,
        );
        expect(plan.totals.lateFees).toBe(40);
      });

      it("isn't used unless the school asked for it", () => {
        const plan = planFeeHistory([row()], context());
        expect(plan.totals.lateFees).toBe(0);
      });
    });
  });

  describe("fees against the fee structure", () => {
    it("splits the total across the month's fee heads", () => {
      const plan = planFeeHistory(
        [row({ fees: "4000" })],
        context({
          expected: structure([
            { head: "Annual", amount: 3000 },
            { head: "Tuition", amount: 1000 },
          ]),
        }),
      );
      expect(lines(plan)).toEqual([
        { head: "Annual", amount: 3000, paid: 0 },
        { head: "Tuition", amount: 1000, paid: 0 },
      ]);
      expect(plan.heads).toEqual(["Annual", "Tuition"]);
      expect(plan.totals).toMatchObject({ discounts: 0, otherFees: 0 });
    });

    it("counts a lower total as a discount", () => {
      const plan = planFeeHistory([row({ fees: "800" })], context());
      expect(lines(plan)).toEqual([{ head: "Tuition", amount: 800, paid: 0 }]);
      expect(plan.totals).toMatchObject({
        billed: 800,
        dues: 800,
        discounts: 200,
      });
    });

    it("never takes a discount off the late fee", () => {
      const plan = planFeeHistory(
        [row({ fees: "500", lateFee: "100" })],
        context(),
      );
      expect(lines(plan)).toEqual([
        { head: "Tuition", amount: 500, paid: 0 },
        { head: LATE_FEE_LINE, amount: 100, paid: 0 },
      ]);
    });

    it("puts what's above the structure under Other Fees", () => {
      const plan = planFeeHistory([row({ fees: "1300" })], context());
      expect(lines(plan)).toEqual([
        { head: "Tuition", amount: 1000, paid: 0 },
        { head: OTHER_FEES_HEAD, amount: 300, paid: 0 },
      ]);
      expect(plan.totals).toMatchObject({ billed: 1300, otherFees: 300 });
    });

    it("puts a month with no structure under Other Fees", () => {
      const plan = planFeeHistory([row()], context({ expected: new Map() }));
      expect(lines(plan)).toEqual([
        { head: OTHER_FEES_HEAD, amount: 1000, paid: 0 },
      ]);
      expect(plan.heads).toEqual([OTHER_FEES_HEAD]);
    });

    it("bills nothing for a month with fees of 0", () => {
      const plan = planFeeHistory([row({ fees: "0" })], context());
      expect(plan.bills).toEqual([]);
      expect(plan.totals.discounts).toBe(0);
    });

    it("doesn't count months left out", () => {
      const plan = planFeeHistory(
        [row({ fees: "500" })],
        context({ billedMonths: new Set(["asha|2026-04"]) }),
      );
      expect(plan.totals.discounts).toBe(0);
    });
  });

  describe("fee heads in the file", () => {
    const heads = { "Tuition Fee": "1000", "Exam Fee": "600" };

    it("bills each head as written, without the fee structure", () => {
      const plan = planFeeHistory(
        [row({ fees: "", heads, paid: "1200", paidOn: "05/04/2026" })],
        context(),
      );
      expect(lines(plan)).toEqual([
        { head: "Tuition Fee", amount: 1000, paid: 1000 },
        { head: "Exam Fee", amount: 600, paid: 200 },
      ]);
      expect(plan.heads).toEqual(["Tuition Fee", "Exam Fee"]);
      expect(plan.totals).toMatchObject({
        billed: 1600,
        dues: 400,
        discounts: 0,
        otherFees: 0,
      });
    });

    it("leaves out a head with 0", () => {
      const plan = planFeeHistory(
        [row({ fees: "", heads: { "Tuition Fee": "1000", "Exam Fee": "0" } })],
        context(),
      );
      expect(lines(plan).map((l) => l.head)).toEqual(["Tuition Fee"]);
    });

    it("adds the late fee after them", () => {
      const plan = planFeeHistory(
        [row({ fees: "", heads, lateFee: "150" })],
        context(),
      );
      expect(lines(plan).at(-1)).toEqual({
        head: LATE_FEE_LINE,
        amount: 150,
        paid: 0,
      });
    });

    it("works blank late fees out from the rule", () => {
      const plan = planFeeHistory(
        [row({ fees: "", heads, paid: "1600", paidOn: "20/04/2026" })],
        context({ lateFeeRule: rule }),
      );
      expect(plan.totals.lateFees).toBe(100);
    });

    it("names the head with a bad amount", () => {
      const r = row({ fees: "", heads: { "Tuition Fee": "abc" } });
      expect(planFeeHistory([r], context()).problems).toEqual([
        `Row ${r.sheetRow}, April 2026: Tuition Fee "abc" isn't a valid amount`,
      ]);
    });

    it("refuses Fees and fee heads for one month", () => {
      const r = row({ heads });
      expect(planFeeHistory([r], context()).problems).toEqual([
        `Row ${r.sheetRow}, April 2026: Fill in Fees or the fee heads, not both`,
      ]);
    });

    it("refuses fee heads for one month on two rows", () => {
      const second = row({ fees: "", heads });
      const { problems } = planFeeHistory(
        [row({ fees: "", heads }), second],
        context(),
      );
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(`Row ${second.sheetRow}, April 2026:`);
    });
  });

  describe("what gets left out", () => {
    it("skips months already billed in the app", () => {
      const plan = planFeeHistory(
        [row(), row({ period: "2026-05" })],
        context({ billedMonths: new Set(["asha|2026-04"]) }),
      );
      expect(plan.totals.alreadyBilled).toBe(1);
      expect(plan.bills.map((b) => b.period)).toEqual(["2026-05"]);
    });

    it("skips months inside an opening balance", () => {
      const plan = planFeeHistory(
        [row(), row({ period: "2026-05" }), row({ period: "2026-06" })],
        context({ openingMonths: new Map([["asha", "2026-05"]]) }),
      );
      expect(plan.totals.inOpeningBalance).toBe(2);
      expect(plan.bills.map((b) => b.period)).toEqual(["2026-06"]);
    });

    it("doesn't object to a skipped month's receipt, so re-uploading is safe", () => {
      const plan = planFeeHistory(
        [row({ paid: "1000", paidOn: "05/04/2026", receiptNo: "R-1" })],
        context({
          billedMonths: new Set(["asha|2026-04"]),
          usedReceipts: new Set(["r-1"]),
        }),
      );
      expect(plan.problems).toEqual([]);
      expect(plan.payments).toEqual([]);
    });
  });

  describe("problems", () => {
    const problem = (over: Partial<FeeHistoryRow>, ctx = context()) => {
      const r = row(over);
      const { problems, bills, payments } = planFeeHistory([r], ctx);
      expect(bills).toEqual([]);
      expect(payments).toEqual([]);
      return problems[0]?.replace(`Row ${r.sheetRow}`, "Row");
    };

    it("names what's wrong with each row", () => {
      expect(problem({ admissionNumber: "" })).toBe(
        "Row: Admission number is missing",
      );
      expect(problem({ admissionNumber: "NOPE" })).toBe(
        "Row: Admission number NOPE isn't a student at this school",
      );
      expect(problem({ admissionNumber: "ADM-3" })).toBe(
        "Row: Left (ADM-3) has left the school",
      );
      expect(problem({ period: "2026-13" })).toBe(
        'Row: "2026-13" isn\'t a month',
      );
      expect(problem({ period: "2026-11" })).toBe(
        "Row: November 2026 hasn't happened yet",
      );
    });

    it("names the month as well, for what's wrong with a month", () => {
      expect(problem({ fees: "abc" })).toBe(
        'Row, April 2026: Fees "abc" isn\'t a valid amount',
      );
      expect(problem({ lateFee: "-5" })).toBe(
        'Row, April 2026: Late Fee "-5" isn\'t a valid amount',
      );
      expect(problem({ paid: "1000", paidOn: "31/02/2026" })).toBe(
        'Row, April 2026: Paid On "31/02/2026" isn\'t a valid date',
      );
      expect(problem({ paid: "1000", mode: "Barter" })).toBe(
        'Row, April 2026: Mode "Barter" isn\'t one we know',
      );
    });

    it("blames a bad admission number once, whatever the months", () => {
      const sheetRow = nextRow++;
      const stranger = { sheetRow, admissionNumber: "NOPE" };
      const { problems } = planFeeHistory(
        [row(stranger), row({ ...stranger, period: "2026-05" })],
        context(),
      );
      expect(problems).toEqual([
        `Row ${sheetRow}: Admission number NOPE isn't a student at this school`,
      ]);
    });

    it("refuses fees for one month on two rows", () => {
      const second = row();
      const { problems } = planFeeHistory([row(), second], context());
      expect(problems).toEqual([
        `Row ${second.sheetRow}, April 2026: Asha has fees for this month on two rows. Keep them on one`,
      ]);
    });

    it("refuses a receipt already in the app", () => {
      const { problems } = planFeeHistory(
        [row({ paid: "1000", receiptNo: "R-1" })],
        context({ usedReceipts: new Set(["r-1"]) }),
      );
      expect(problems[0]).toContain("Receipt R-1 is already in Kora");
    });

    it("refuses one receipt for two students", () => {
      const { problems } = planFeeHistory(
        [
          row({ paid: "1000", receiptNo: "R-1" }),
          row({ admissionNumber: "ADM-2", paid: "1000", receiptNo: "R-1" }),
        ],
        context(),
      );
      expect(problems[0]).toContain("Receipt R-1 is also used for another");
    });
  });

  describe("payments with no date", () => {
    it("uses the bill's due date, and says so", () => {
      const plan = planFeeHistory([row({ paid: "1000" })], context());
      expect(plan.payments[0].date).toBe("2026-04-10");
      expect(plan.totals.undatedPayments).toBe(1);
    });

    it("never dates a payment in the future", () => {
      const plan = planFeeHistory(
        [row({ period: "2026-10", paid: "1000" })],
        context({ today: "2026-10-05" }),
      );
      expect(plan.payments[0].date).toBe("2026-10-05");
    });
  });
});

describe("findSharedReceipts", () => {
  it("finds a receipt used for two students across the file", () => {
    const second = row({ admissionNumber: "ADM-2", receiptNo: "R-9" });
    expect(findSharedReceipts([row({ receiptNo: "r-9" }), second])).toEqual([
      `Row ${second.sheetRow}, April 2026: Receipt R-9 is also used for another student`,
    ]);
    expect(
      findSharedReceipts([
        row({ receiptNo: "R-9" }),
        row({ period: "2026-05", receiptNo: "R-9" }),
      ]),
    ).toEqual([]);
  });
});

describe("batchHistoryRows", () => {
  it("keeps every student's rows in one batch", () => {
    const rows = ["A", "B", "C"].flatMap((admissionNumber) =>
      [1, 2, 3].map(() => row({ admissionNumber })),
    );
    const batches = batchHistoryRows(rows, 4);
    expect(batches.map((b) => b.length)).toEqual([3, 3, 3]);
    for (const batch of batches) {
      expect(new Set(batch.map((r) => r.admissionNumber)).size).toBe(1);
    }
    expect(batches.flat()).toHaveLength(9);
  });
});

describe("sessions", () => {
  const start = new Date("2026-04-01");
  const sessions = [
    {
      id: "old",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-04-30"),
      isCurrent: false,
    },
    {
      id: "now",
      startDate: start,
      endDate: new Date("2027-03-31"),
      isCurrent: true,
    },
  ];

  it("finds a month's session, the current one if two overlap", () => {
    expect(findSessionForPeriod("2025-06", sessions)?.id).toBe("old");
    expect(findSessionForPeriod("2026-04", sessions)?.id).toBe("now");
    expect(findSessionForPeriod("2024-06", sessions)).toBeUndefined();
  });

  it("shapes a missing past session like the current one", () => {
    expect(pastSessionFor("2024-06", start)).toEqual({
      name: "2024-25",
      startDate: new Date("2024-04-01"),
      endDate: new Date("2025-03-31"),
    });
    expect(pastSessionFor("2025-02", start).name).toBe("2024-25");
  });
});
