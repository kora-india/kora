import { describe, it, expect } from "vitest";
import { receiptPrintHtml } from "../fee-receipt-modal";
import type { FeeReceiptData } from "@/lib/actions/fee-allocator";

const receipt = (overrides: Partial<FeeReceiptData> = {}): FeeReceiptData => ({
  schoolName: "St. Mary's School",
  schoolAddress: "12, Station Road, Ranchi",
  schoolContact: "office@stmarys.in",
  timestamp: "Oct 28, 2026, 10:15 AM",
  receiptNo: "RCP-2026-00007",
  regNo: "ADM-101",
  rollNumber: "7",
  studentName: "Aman Kumar",
  className: "Grade 3-A",
  items: [{ head: "Tuition Fee", amount: 1000 }],
  total: 3000,
  amountPaid: 2000,
  paidForMonths: "April 2026 - May 2026 (2 Months)",
  paymentType: "UPI (TXN123)",
  generatedBy: "Test Admin",
  isPartial: true,
  documentType: "PARTIAL_INVOICE",
  monthTotalBilled: 3000,
  monthTotalPaid: 2000,
  monthRemainingDue: 1000,
  outstandingBefore: 3000,
  remainingOutstanding: 1000,
  paymentStatus: "PARTIAL_PAYMENT",
  paymentStatusText: "PARTIAL PAYMENT — ₹1,000 DUE",
  monthAllocations: [
    {
      chargeId: "a",
      month: "April 2026",
      feeDue: 1500,
      previouslyPaid: 0,
      paidNow: 1500,
      balanceDue: 0,
      status: "PAID",
    },
    {
      chargeId: "b",
      month: "May 2026",
      feeDue: 1500,
      previouslyPaid: 0,
      paidNow: 500,
      balanceDue: 1000,
      status: "PARTIALLY PAID",
    },
  ],
  ...overrides,
});

describe("the printed receipt", () => {
  it("shows the payment's figures in rupees and paise", () => {
    const html = receiptPrintHtml(receipt());
    expect(html).toContain("RCP-2026-00007");
    expect(html).toContain("PARTIAL PAYMENT — ₹1000.00 DUE");
    expect(html).toContain("₹2000.00");
    expect(html).toContain("St. Mary&#39;s School");
    expect(html).not.toMatch(/NaN|undefined|Invalid Date|\[object Object\]/);
  });

  it("prints names as text, never as markup", () => {
    const html = receiptPrintHtml(
      receipt({
        studentName: '<img src=x onerror="alert(1)">',
        schoolName: "<script>steal()</script>",
        monthAllocations: [
          {
            chargeId: "a",
            month: "<b>April</b>",
            feeDue: 1,
            previouslyPaid: 0,
            paidNow: 1,
            balanceDue: 0,
            status: "PAID",
          },
        ],
        items: [{ head: "<svg onload=x>", amount: 1 }],
        generatedBy: "<i>admin</i>",
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>steal");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<b>April");
    expect(html).not.toContain("<i>admin");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("says paid in full when nothing is left", () => {
    const html = receiptPrintHtml(
      receipt({
        remainingOutstanding: 0,
        monthRemainingDue: 0,
        paymentStatus: "PAID_IN_FULL",
      }),
    );
    expect(html).toContain("PAID IN FULL");
    expect(html).not.toContain("PARTIAL PAYMENT");
  });
});
