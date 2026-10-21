import { describe, it, expect } from "vitest";
import {
  buildPaymentPayload,
  previewMonth,
  splitMonthTotal,
} from "../fees/payment-split";

const month = {
  id: "c1",
  items: [
    { id: "i2", due: 500 },
    { id: "i1", due: 1000 },
  ],
};

describe("fee payment split (U10)", () => {
  it("fills items in id order and keeps the rest as surplus", () => {
    expect(splitMonthTotal(month.items, 1200)).toEqual({
      allocations: [
        { itemId: "i1", amount: 1000 },
        { itemId: "i2", amount: 200 },
      ],
      surplus: 0,
    });
    expect(splitMonthTotal(month.items, 1600).surplus).toBe(100);
  });

  it("sends a chosen split item by item, otherwise the month total", () => {
    const chosen = buildPaymentPayload(
      [month],
      { c1: true },
      { c1: "500" },
      { i2: "500" },
    );
    expect(chosen).toEqual({
      monthPayments: [],
      itemPayments: [{ chargeItemId: "i2", amount: 500 }],
    });
    // Item amounts that don't add up to the month amount: send the total.
    const total = buildPaymentPayload(
      [month],
      { c1: true },
      { c1: "700" },
      { i2: "500" },
    );
    expect(total.monthPayments).toEqual([{ chargeId: "c1", amount: 700 }]);
    expect(previewMonth(month, 700, { i2: "500" }).allocations).toEqual([
      { itemId: "i1", amount: 700 },
    ]);
  });

  it("skips unselected and empty months", () => {
    expect(
      buildPaymentPayload([month], { c1: false }, { c1: "500" }, {}),
    ).toEqual({
      monthPayments: [],
      itemPayments: [],
    });
  });
});
