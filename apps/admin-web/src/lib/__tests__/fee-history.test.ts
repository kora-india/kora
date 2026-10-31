import { describe, it, expect } from "vitest";
import {
  LATE_FEE_LINE,
  batchHistoryRows,
  findHistoryColumns,
  findSessionForPeriod,
  findSharedReceipts,
  historyHeaders,
  monthsBetween,
  parseMode,
  parseMonth,
  pastSessionFor,
  planFeeHistory,
  toHistoryRow,
  type FeeHistoryRow,
  type HistoryColumns,
  type HistoryContext,
} from "../fees/fee-history";

const students = [
  { id: "asha", admissionNumber: "ADM-1", name: "Asha", isActive: true },
  { id: "kabir", admissionNumber: "ADM-2", name: "Kabir", isActive: true },
  { id: "left", admissionNumber: "ADM-3", name: "Left", isActive: false },
];

const context = (over: Partial<HistoryContext> = {}): HistoryContext => ({
  students,
  billedMonths: new Set(),
  openingMonths: new Map(),
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
  month: "Apr 2026",
  heads: { Tuition: "1000" },
  lateFee: "",
  discount: "",
  paid: "",
  paidOn: "",
  mode: "",
  receiptNo: "",
  reference: "",
  ...over,
});

const lines = (plan: ReturnType<typeof planFeeHistory>) =>
  plan.bills.flatMap((b) => b.lines);

describe("template columns", () => {
  const headers = historyHeaders(["Tuition Fee", "Transport Fee"]);

  it("finds every column, and treats the rest as fee heads", () => {
    const columns = findHistoryColumns(headers) as HistoryColumns;
    expect(columns).toMatchObject({
      admissionNumber: "Admission Number",
      month: "Month",
      paid: "Paid (₹)",
      lateFee: "Late Fee (₹)",
      discount: "Discount (₹)",
      paidOn: "Paid On",
      mode: "Mode",
      receiptNo: "Receipt No",
      reference: "Reference",
    });
    expect(columns.heads).toEqual([
      { header: "Tuition Fee (₹)", name: "Tuition Fee" },
      { header: "Transport Fee (₹)", name: "Transport Fee" },
    ]);
  });

  it("says what a different file lacks", () => {
    expect(findHistoryColumns(["Full Name", "Paid"])).toEqual({
      missing: ["Admission Number", "Month"],
    });
  });

  it("turns a sheet row into a row, or nothing when it's blank", () => {
    const columns = findHistoryColumns(headers) as HistoryColumns;
    const cells = {
      "Admission Number": "ADM-1",
      Month: "Apr 2026",
      "Tuition Fee (₹)": 1000,
      "Transport Fee (₹)": "",
      "Late Fee (₹)": "",
      "Paid (₹)": 1000,
      "Paid On": "05/04/2026",
      Mode: "Cash",
      "Receipt No": "R-1",
    };
    expect(toHistoryRow(cells, 7, columns)).toMatchObject({
      sheetRow: 7,
      admissionNumber: "ADM-1",
      heads: { "Tuition Fee": "1000" },
      paid: "1000",
      receiptNo: "R-1",
    });
    expect(
      toHistoryRow(
        { "Admission Number": "ADM-1", Month: "Apr 2026" },
        8,
        columns,
      ),
    ).toBeNull();
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
            reference: "UTR9",
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
          reference: "UTR9",
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

    it("pays fee heads in column order", () => {
      const plan = planFeeHistory(
        [
          row({
            heads: { Tuition: "1000", Transport: "500" },
            paid: "1200",
            paidOn: "05/04/2026",
          }),
        ],
        context(),
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
            month: "May 2026",
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

    it("takes a second payment on a copied row", () => {
      const plan = planFeeHistory(
        [
          row({ paid: "400", paidOn: "05/04/2026", receiptNo: "R-1" }),
          row({
            heads: {},
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
        [row({ heads: {}, paid: "800", paidOn: "05/04/2026" })],
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
          row({ month: "May 2026", lateFee: "75" }),
          row({ month: "Jun 2026" }),
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
        [row({ heads: {}, lateFee: "150" })],
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
            row({ heads: {}, paid: "500", paidOn: "15/06/2026" }),
          ],
          withRule,
        );
        expect(plan.totals.lateFees).toBe(300);
      });

      it("never overrides a late fee in the file, even 0", () => {
        const plan = planFeeHistory(
          [row({ lateFee: "40" }), row({ month: "May 2026", lateFee: "0" })],
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

  describe("discounts", () => {
    it("comes off the fee heads in order", () => {
      const plan = planFeeHistory(
        [row({ heads: { Tuition: "300", Lab: "500" }, discount: "400" })],
        context(),
      );
      expect(lines(plan)).toEqual([{ head: "Lab", amount: 400, paid: 0 }]);
      expect(plan.totals).toMatchObject({
        billed: 400,
        dues: 400,
        discounts: 400,
      });
    });

    it("never touches the late fee", () => {
      const plan = planFeeHistory(
        [row({ discount: "1000", lateFee: "100" })],
        context(),
      );
      expect(lines(plan)).toEqual([
        { head: LATE_FEE_LINE, amount: 100, paid: 0 },
      ]);
    });

    it("can't be more than the month's fees", () => {
      const r = row({ discount: "1500" });
      expect(planFeeHistory([r], context()).problems).toEqual([
        `Row ${r.sheetRow}: Discount is more than April 2026's fees`,
      ]);
    });
  });

  describe("what gets left out", () => {
    it("skips months already billed in the app", () => {
      const plan = planFeeHistory(
        [row(), row({ month: "May 2026" })],
        context({ billedMonths: new Set(["asha|2026-04"]) }),
      );
      expect(plan.totals.alreadyBilled).toBe(1);
      expect(plan.bills.map((b) => b.period)).toEqual(["2026-05"]);
    });

    it("skips months inside an opening balance", () => {
      const plan = planFeeHistory(
        [row(), row({ month: "May 2026" }), row({ month: "Jun 2026" })],
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
      return problems[0]?.replace(`Row ${r.sheetRow}: `, "");
    };

    it("names what's wrong with each row", () => {
      expect(problem({ admissionNumber: "" })).toBe(
        "Admission number is missing",
      );
      expect(problem({ admissionNumber: "NOPE" })).toBe(
        "Admission number NOPE isn't a student at this school",
      );
      expect(problem({ admissionNumber: "ADM-3" })).toBe(
        "Left (ADM-3) has left the school",
      );
      expect(problem({ month: "Someday" })).toBe(
        'Month "Someday" can\'t be read. Use a month like Apr 2026',
      );
      expect(problem({ month: "Nov 2026" })).toBe(
        "November 2026 hasn't happened yet",
      );
      expect(problem({ heads: { Tuition: "abc" } })).toBe(
        'Tuition "abc" isn\'t a valid amount',
      );
      expect(problem({ lateFee: "-5" })).toBe(
        'Late Fee "-5" isn\'t a valid amount',
      );
      expect(problem({ paid: "1000", paidOn: "31/02/2026" })).toBe(
        'Paid On "31/02/2026" isn\'t a valid date',
      );
      expect(problem({ paid: "1000", mode: "Barter" })).toBe(
        'Mode "Barter" isn\'t one we know',
      );
    });

    it("refuses a month given twice with amounts", () => {
      const second = row();
      const { problems } = planFeeHistory([row(), second], context());
      expect(problems).toEqual([
        `Row ${second.sheetRow}: Asha has April 2026 twice with fee amounts. Keep the amounts on one row`,
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
        [row({ month: "Oct 2026", paid: "1000" })],
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
      `Row ${second.sheetRow}: Receipt R-9 is also used for another student`,
    ]);
    expect(
      findSharedReceipts([
        row({ receiptNo: "R-9" }),
        row({ month: "May 2026", receiptNo: "R-9" }),
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
