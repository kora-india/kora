import { describe, it, expect } from "vitest";
import {
  buildMonthList,
  firstPolicyError,
  monthPolicyError,
} from "../fees/collection";

const charges = [
  {
    id: "oct",
    title: "October",
    dueDate: "2026-10-10",
    status: "PARTIAL",
    items: [
      {
        id: "t",
        componentId: "tuition",
        amount: 1000,
        paidAmount: 0,
        status: "PENDING",
        component: { name: "Tuition" },
      },
      {
        id: "w",
        componentId: "bus",
        amount: 1000,
        paidAmount: 0,
        status: "WAIVED",
        component: { name: "Bus" },
      },
      {
        id: "l",
        componentId: "late",
        amount: 50,
        paidAmount: 0,
        status: "PENDING",
        component: { name: "Fine", category: "LATE_FEE" },
      },
    ],
  },
  {
    id: "sep",
    title: "September",
    dueDate: "2026-09-10",
    status: "PAID",
    items: [
      {
        id: "x",
        componentId: "tuition",
        amount: 1000,
        paidAmount: 1000,
        status: "PAID",
      },
    ],
  },
];

describe("fee collection (U11)", () => {
  const { monthList, totalOutstanding } = buildMonthList(charges);

  it("lists months with something due, waived items excluded from what's owed", () => {
    expect(monthList.map((m) => m.id)).toEqual(["oct"]);
    expect(monthList[0]).toMatchObject({
      netCharge: 2050,
      billed: 1050,
      totalDue: 1050,
    });
    expect(totalOutstanding).toBe(1050);
    expect(monthList[0].items.find((i) => i.id === "l")?.isLateFee).toBe(true);
  });

  it("bases the minimum on what's billed, not waived items (as the server does)", () => {
    const policy = { mode: "ALLOW_PARTIAL", minPercentage: 50, minAmount: 0 };
    // 50% of 1,050 billed is 525; counting the waived bus fee would ask for 1,025.
    expect(monthPolicyError(monthList[0], 525, policy)).toBeNull();
    expect(monthPolicyError(monthList[0], 500, policy)).toMatch(
      /at least 50% \(₹525\)/,
    );
  });

  it("requires full payment under FULL_ONLY", () => {
    const policy = { mode: "FULL_ONLY", minPercentage: 0, minAmount: 0 };
    expect(
      firstPolicyError(monthList, { oct: true }, { oct: "1000" }, policy),
    ).toMatch(/fully/);
    expect(
      firstPolicyError(monthList, { oct: true }, { oct: "1050" }, policy),
    ).toBeNull();
    expect(
      firstPolicyError(monthList, { oct: false }, { oct: "10" }, policy),
    ).toBeNull();
  });
});
