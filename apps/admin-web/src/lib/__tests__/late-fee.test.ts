import { describe, it, expect } from "vitest";
import { calculateLateFee, type LateFeeRule } from "../fees/late-fee";

const rule = (over: Partial<LateFeeRule> = {}): LateFeeRule => ({
  lateFeeAmount: 100,
  lateFeeFrequency: "MONTHLY",
  maxLateFeeCap: null,
  ...over,
});

describe("calculateLateFee", () => {
  it("charges nothing on time", () => {
    expect(calculateLateFee(rule(), 0, 1000)).toBe(0);
    expect(calculateLateFee(rule(), -5, 1000)).toBe(0);
  });

  it("charges per month, up to three", () => {
    expect(calculateLateFee(rule(), 1, 10000)).toBe(100);
    expect(calculateLateFee(rule(), 30, 10000)).toBe(100);
    expect(calculateLateFee(rule(), 31, 10000)).toBe(200);
    expect(calculateLateFee(rule(), 400, 10000)).toBe(300);
  });

  it("charges per week up to five, and per day up to thirty", () => {
    const weekly = rule({ lateFeeFrequency: "WEEKLY" });
    expect(calculateLateFee(weekly, 8, 10000)).toBe(200);
    expect(calculateLateFee(weekly, 100, 10000)).toBe(500);
    const daily = rule({ lateFeeFrequency: "DAILY", lateFeeAmount: 10 });
    expect(calculateLateFee(daily, 5, 10000)).toBe(50);
    expect(calculateLateFee(daily, 100, 10000)).toBe(300);
  });

  it("stops at the school's cap", () => {
    expect(calculateLateFee(rule({ maxLateFeeCap: 150 }), 400, 10000)).toBe(
      150,
    );
  });

  it("stops at half the bill, but never below one late fee", () => {
    expect(calculateLateFee(rule(), 400, 400)).toBe(200);
    expect(calculateLateFee(rule(), 400, 100)).toBe(100);
  });
});
