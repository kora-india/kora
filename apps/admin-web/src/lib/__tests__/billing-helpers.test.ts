import { describe, it, expect } from "vitest";
import {
  billingBucket,
  formatPeriodLabel,
  isComponentDue,
  isPeriodWithinSession,
  periodKeyFromDate,
} from "../fees/billing-period";
import {
  DEFAULT_TIME_ZONE,
  resolveTimeZone,
  todayInTimeZone,
} from "../fees/timezone";
import { formatReceiptNumber } from "../fees/receipt-number";
import { deriveChargeStatus } from "../fees/charge-status";

// Session April 2026 – March 2027, as Prisma returns @db.Date values.
const sessionStart = new Date("2026-04-01T00:00:00.000Z");
const sessionEnd = new Date("2027-03-31T00:00:00.000Z");

describe("billing periods", () => {
  it("puts each frequency in the right bucket", () => {
    expect(billingBucket("MONTHLY", sessionStart, "2026-05")).toBe("M:2026-05");
    expect(billingBucket("QUARTERLY", sessionStart, "2026-04")).toBe("Q:0");
    expect(billingBucket("QUARTERLY", sessionStart, "2026-06")).toBe("Q:0");
    expect(billingBucket("QUARTERLY", sessionStart, "2026-07")).toBe("Q:1");
    expect(billingBucket("QUARTERLY", sessionStart, "2027-01")).toBe("Q:3");
    expect(billingBucket("HALF_YEARLY", sessionStart, "2026-09")).toBe("H:0");
    expect(billingBucket("HALF_YEARLY", sessionStart, "2026-10")).toBe("H:1");
    expect(billingBucket("YEARLY", sessionStart, "2026-11")).toBe("Y");
    expect(billingBucket("ONE_TIME", sessionStart, "2026-11")).toBe("ONCE");
    expect(billingBucket("CUSTOM", sessionStart, "2026-11")).toBeNull();
  });

  it("bills a quarterly fee once per quarter, even if the quarter's first month was skipped", () => {
    const none = new Set<string>();
    expect(isComponentDue("QUARTERLY", sessionStart, "2026-05", none)).toBe(
      true,
    );
    const billedInMay = new Set(["Q:0"]);
    expect(
      isComponentDue("QUARTERLY", sessionStart, "2026-06", billedInMay),
    ).toBe(false);
    expect(
      isComponentDue("QUARTERLY", sessionStart, "2026-07", billedInMay),
    ).toBe(true);
  });

  it("never auto-bills CUSTOM components", () => {
    expect(isComponentDue("CUSTOM", sessionStart, "2026-04", new Set())).toBe(
      false,
    );
  });

  it("checks the billing month falls inside the session", () => {
    expect(isPeriodWithinSession("2026-04", sessionStart, sessionEnd)).toBe(
      true,
    );
    expect(isPeriodWithinSession("2027-03", sessionStart, sessionEnd)).toBe(
      true,
    );
    expect(isPeriodWithinSession("2026-03", sessionStart, sessionEnd)).toBe(
      false,
    );
    expect(isPeriodWithinSession("2027-04", sessionStart, sessionEnd)).toBe(
      false,
    );
    expect(isPeriodWithinSession("2026-13", sessionStart, sessionEnd)).toBe(
      false,
    );
  });

  it("formats and derives period keys", () => {
    expect(formatPeriodLabel("2026-10")).toBe("October 2026");
    expect(periodKeyFromDate(new Date("2026-10-10T00:00:00.000Z"))).toBe(
      "2026-10",
    );
  });
});

describe("school time zones", () => {
  it("cleans up the value the setup wizard stores", () => {
    expect(resolveTimeZone("Asia/Kolkata (IST)")).toBe("Asia/Kolkata");
    expect(resolveTimeZone("Europe/London")).toBe("Europe/London");
    expect(resolveTimeZone("Not/AZone")).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
  });

  it("uses the school's calendar date, not the server's", () => {
    // 20:00 UTC on 13 Oct is already 14 Oct in India.
    const now = new Date("2026-10-13T20:00:00.000Z");
    expect(todayInTimeZone("Asia/Kolkata", now).toISOString()).toBe(
      "2026-10-14T00:00:00.000Z",
    );
    expect(todayInTimeZone("UTC", now).toISOString()).toBe(
      "2026-10-13T00:00:00.000Z",
    );
  });
});

describe("receipt numbers", () => {
  it("fills in the format tokens", () => {
    expect(
      formatReceiptNumber("{PREFIX}-{YYYY}-{SEQ:5}", "rcp", 42, 2026),
    ).toBe("RCP-2026-00042");
    expect(formatReceiptNumber("{PREFIX}/{YY}/{SEQ}", "DPS", 7, 2026)).toBe(
      "DPS/26/00007",
    );
  });

  it("adds a sequence when the format has none", () => {
    expect(formatReceiptNumber("{PREFIX}", "RCP", 3, 2026)).toBe("RCP-00003");
  });
});

describe("charge status", () => {
  const today = new Date("2026-10-14T00:00:00.000Z");
  const future = new Date("2026-10-20T00:00:00.000Z");
  const past = new Date("2026-10-10T00:00:00.000Z");

  it("derives status from items and due date", () => {
    expect(
      deriveChargeStatus(
        [{ status: "PAID" }, { status: "WAIVED" }],
        past,
        today,
      ),
    ).toBe("PAID");
    expect(deriveChargeStatus([{ status: "WAIVED" }], past, today)).toBe(
      "WAIVED",
    );
    expect(deriveChargeStatus([{ status: "PARTIAL" }], future, today)).toBe(
      "PARTIAL",
    );
    expect(deriveChargeStatus([{ status: "PARTIAL" }], past, today)).toBe(
      "OVERDUE",
    );
    expect(deriveChargeStatus([{ status: "PENDING" }], future, today)).toBe(
      "PENDING",
    );
  });
});
