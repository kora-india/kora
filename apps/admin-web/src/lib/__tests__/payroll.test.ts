import { describe, expect, it } from "vitest";
import {
  computeSalary,
  maskAccount,
  recentMonths,
  serializeSlip,
  successfulPayout,
  formatPayrollMonth,
} from "@/lib/payroll";

describe("computeSalary", () => {
  it("computes gross, deductions and net", () => {
    expect(
      computeSalary({
        basicSalary: 35000,
        allowances: 10000,
        pfDeduction: 1500,
        otherDeductions: 500,
      }),
    ).toEqual({ grossSalary: 45000, totalDeductions: 2000, netSalary: 43000 });
  });

  it("avoids floating point drift", () => {
    const r = computeSalary({
      basicSalary: 0.1,
      allowances: 0.2,
      pfDeduction: 0,
      otherDeductions: 0,
    });
    expect(r.grossSalary).toBe(0.3);
  });

  it("can produce a negative net, which callers must reject", () => {
    expect(
      computeSalary({
        basicSalary: 100,
        allowances: 0,
        pfDeduction: 150,
        otherDeductions: 0,
      }).netSalary,
    ).toBe(-50);
  });
});

describe("maskAccount", () => {
  it("only exposes the last four digits", () => {
    expect(maskAccount("1234 5678 9012 4821")).toBe("•••• 4821");
  });
  it("returns null for missing or too-short values", () => {
    expect(maskAccount(null)).toBeNull();
    expect(maskAccount("12")).toBeNull();
  });
});

describe("months", () => {
  it("lists recent months newest first across a year boundary", () => {
    const months = recentMonths(3, new Date(2026, 1, 15));
    expect(months).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ]);
  });
  it("formats a payroll month", () => {
    expect(formatPayrollMonth(2026, 9)).toBe("September 2026");
  });
});

describe("serializeSlip", () => {
  it("converts decimals and dates, and finds the successful payout", () => {
    const dec = (v: string) => ({ toString: () => v });
    const slip = serializeSlip({
      id: "s1",
      slipNumber: "SAL-2026-09-001",
      month: 9,
      year: 2026,
      basicSalary: dec("35000.00"),
      allowances: dec("10000.00"),
      pfDeduction: dec("1500.00"),
      otherDeductions: dec("500.00"),
      grossSalary: dec("45000.00"),
      totalDeductions: dec("2000.00"),
      netSalary: dec("43000.00"),
      status: "PAID",
      sentAt: null,
      createdAt: new Date("2026-09-28T00:00:00Z"),
      payouts: [
        {
          id: "p0",
          amount: dec("43000"),
          method: "UPI",
          status: "FAILED",
          transactionId: "PAY-1",
          createdAt: new Date(),
        },
        {
          id: "p1",
          amount: dec("43000"),
          method: "BANK_TRANSFER",
          status: "SUCCEEDED",
          transactionId: "PAY-2",
          processedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    });
    expect(slip.netSalary).toBe(43000);
    expect(typeof slip.createdAt).toBe("string");
    expect(successfulPayout(slip)?.id).toBe("p1");
  });
});
