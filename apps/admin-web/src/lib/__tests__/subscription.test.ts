import { describe, it, expect } from "vitest";
import {
  evaluateSubscriptionValidity,
  hasFeatureAccess,
  GRACE_PERIOD_DAYS,
  TRIAL_DURATION_DAYS,
} from "../subscription";
import { SubscriptionPlan, SubscriptionStatus } from "@schoolos/db";

describe("Subscription Validity & Trial Engine", () => {
  const baseDate = new Date("2026-09-01T12:00:00Z");

  it("should evaluate an active 14-day trial with remaining days", () => {
    const trialEndsAt = new Date("2026-09-11T12:00:00Z"); // 10 days later
    const result = evaluateSubscriptionValidity(
      {
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
      },
      baseDate,
    );

    expect(result.isTrial).toBe(true);
    expect(result.isActive).toBe(true);
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(10);
    expect(result.status).toBe(SubscriptionStatus.TRIAL);
  });

  it("should evaluate an expired trial when trialEndsAt has passed", () => {
    const trialEndsAt = new Date("2026-08-31T12:00:00Z"); // 1 day before baseDate
    const result = evaluateSubscriptionValidity(
      {
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
      },
      baseDate,
    );

    expect(result.isTrial).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.daysRemaining).toBe(0);
    expect(result.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it("should evaluate an active paid subscription within billing cycle", () => {
    const currentPeriodEnd = new Date("2026-09-25T12:00:00Z"); // 24 days later
    const result = evaluateSubscriptionValidity(
      {
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd,
      },
      baseDate,
    );

    expect(result.isTrial).toBe(false);
    expect(result.isActive).toBe(true);
    expect(result.isPastDue).toBe(false);
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(24);
  });

  it("should grant 7-day grace period (PAST_DUE) when period ends recently", () => {
    // 3 days past currentPeriodEnd
    const currentPeriodEnd = new Date("2026-08-29T12:00:00Z");
    const result = evaluateSubscriptionValidity(
      {
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd,
      },
      baseDate,
    );

    expect(result.isPastDue).toBe(true);
    expect(result.isActive).toBe(true); // Still permitted write operations during grace
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(4); // 7 - 3 = 4 days grace remaining
    expect(result.status).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("should mark subscription EXPIRED when period ended more than 7 days ago", () => {
    // 10 days past currentPeriodEnd
    const currentPeriodEnd = new Date("2026-08-22T12:00:00Z");
    const result = evaluateSubscriptionValidity(
      {
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd,
      },
      baseDate,
    );

    expect(result.isExpired).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.status).toBe(SubscriptionStatus.EXPIRED);
    expect(result.daysRemaining).toBe(0);
  });

  it("should treat CANCELLED subscription as expired", () => {
    const result = evaluateSubscriptionValidity(
      {
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.CANCELLED,
      },
      baseDate,
    );

    expect(result.isExpired).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.status).toBe(SubscriptionStatus.CANCELLED);
  });
});

describe("Feature Gating Matrix", () => {
  it("should grant full access to all features during TRIAL", () => {
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.TRIAL,
        "EXAMS",
      ),
    ).toBe(true);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.TRIAL,
        "TIMETABLE",
      ),
    ).toBe(true);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.TRIAL,
        "ANALYTICS",
      ),
    ).toBe(true);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.TRIAL,
        "TRANSPORT",
      ),
    ).toBe(true);
  });

  it("should restrict premium features on FREE tier", () => {
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.ACTIVE,
        "EXAMS",
      ),
    ).toBe(false);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.ACTIVE,
        "TIMETABLE",
      ),
    ).toBe(false);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.ACTIVE,
        "ANALYTICS",
      ),
    ).toBe(false);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.FREE,
        SubscriptionStatus.ACTIVE,
        "TRANSPORT",
      ),
    ).toBe(false);
  });

  it("should allow TRANSPORT on BASIC tier, but restrict EXAMS, TIMETABLE, and ANALYTICS", () => {
    expect(
      hasFeatureAccess(
        SubscriptionPlan.BASIC,
        SubscriptionStatus.ACTIVE,
        "TRANSPORT",
      ),
    ).toBe(true);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.BASIC,
        SubscriptionStatus.ACTIVE,
        "EXAMS",
      ),
    ).toBe(false);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.BASIC,
        SubscriptionStatus.ACTIVE,
        "TIMETABLE",
      ),
    ).toBe(false);
    expect(
      hasFeatureAccess(
        SubscriptionPlan.BASIC,
        SubscriptionStatus.ACTIVE,
        "ANALYTICS",
      ),
    ).toBe(false);
  });

  it("should allow all features on PRO and ENTERPRISE tiers", () => {
    for (const plan of [SubscriptionPlan.PRO, SubscriptionPlan.ENTERPRISE]) {
      expect(hasFeatureAccess(plan, SubscriptionStatus.ACTIVE, "EXAMS")).toBe(
        true,
      );
      expect(
        hasFeatureAccess(plan, SubscriptionStatus.ACTIVE, "TIMETABLE"),
      ).toBe(true);
      expect(
        hasFeatureAccess(plan, SubscriptionStatus.ACTIVE, "ANALYTICS"),
      ).toBe(true);
      expect(
        hasFeatureAccess(plan, SubscriptionStatus.ACTIVE, "TRANSPORT"),
      ).toBe(true);
    }
  });
});
