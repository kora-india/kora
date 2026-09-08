import { prisma, SubscriptionPlan, SubscriptionStatus } from "@schoolos/db";

export type FeatureKey = "EXAMS" | "TIMETABLE" | "ANALYTICS" | "TRANSPORT";

export interface SubscriptionEvaluation {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  isTrial: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isExpired: boolean;
  daysRemaining: number;
  message?: string;
}

export const GRACE_PERIOD_DAYS = 7;
export const TRIAL_DURATION_DAYS = 14;

/**
 * Evaluates the runtime validity, remaining days, and status transitions of a subscription.
 */
export function evaluateSubscriptionValidity(
  subscription: {
    plan?: SubscriptionPlan | string | null;
    status?: SubscriptionStatus | string | null;
    trialEndsAt?: Date | string | null;
    currentPeriodStart?: Date | string | null;
    currentPeriodEnd?: Date | string | null;
  } | null,
  now: Date = new Date(),
): SubscriptionEvaluation {
  const plan =
    (subscription?.plan as SubscriptionPlan) || SubscriptionPlan.FREE;
  const rawStatus =
    (subscription?.status as SubscriptionStatus) || SubscriptionStatus.ACTIVE;

  // If status is explicitly CANCELLED or EXPIRED in database
  if (rawStatus === SubscriptionStatus.CANCELLED) {
    return {
      status: SubscriptionStatus.CANCELLED,
      plan,
      isTrial: false,
      isActive: false,
      isPastDue: false,
      isExpired: true,
      daysRemaining: 0,
      message: "Subscription has been cancelled.",
    };
  }

  // 1. Check Free Trial Validity
  if (rawStatus === SubscriptionStatus.TRIAL) {
    const trialEnd = subscription?.trialEndsAt
      ? new Date(subscription.trialEndsAt)
      : null;

    if (!trialEnd) {
      // Fallback: 14 days active trial if not set
      return {
        status: SubscriptionStatus.TRIAL,
        plan,
        isTrial: true,
        isActive: true,
        isPastDue: false,
        isExpired: false,
        daysRemaining: TRIAL_DURATION_DAYS,
      };
    }

    const diffMs = trialEnd.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return {
        status: SubscriptionStatus.EXPIRED,
        plan,
        isTrial: true,
        isActive: false,
        isPastDue: false,
        isExpired: true,
        daysRemaining: 0,
        message: "Your 14-day free trial has expired.",
      };
    }

    return {
      status: SubscriptionStatus.TRIAL,
      plan,
      isTrial: true,
      isActive: true,
      isPastDue: false,
      isExpired: false,
      daysRemaining: daysLeft,
      message: `Trial active: ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining.`,
    };
  }

  // 2. Check Paid Period Validity (ACTIVE / PAST_DUE)
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  // If no period end is specified, assume active (e.g. Free plan without end date)
  if (!periodEnd) {
    return {
      status: SubscriptionStatus.ACTIVE,
      plan,
      isTrial: false,
      isActive: true,
      isPastDue: false,
      isExpired: false,
      daysRemaining: Infinity,
    };
  }

  const diffMs = periodEnd.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Current period is active
  if (daysLeft >= 0) {
    return {
      status: SubscriptionStatus.ACTIVE,
      plan,
      isTrial: false,
      isActive: true,
      isPastDue: false,
      isExpired: false,
      daysRemaining: daysLeft,
    };
  }

  // Current period passed: check 7-day grace period
  const graceDaysRemaining = GRACE_PERIOD_DAYS + daysLeft; // daysLeft is negative

  if (graceDaysRemaining > 0) {
    return {
      status: SubscriptionStatus.PAST_DUE,
      plan,
      isTrial: false,
      isActive: true, // Still allowed write access during grace period
      isPastDue: true,
      isExpired: false,
      daysRemaining: graceDaysRemaining,
      message: `Billing past due. Grace period active (${graceDaysRemaining} day${graceDaysRemaining === 1 ? "" : "s"} left).`,
    };
  }

  // Exceeded grace period: EXPIRED
  return {
    status: SubscriptionStatus.EXPIRED,
    plan,
    isTrial: false,
    isActive: false,
    isPastDue: false,
    isExpired: true,
    daysRemaining: 0,
    message: "Subscription has expired. Please renew to continue.",
  };
}

/**
 * Evaluates whether a given feature is allowed under the current plan and subscription status.
 * Note: During an active TRIAL, institutions receive full PRO access!
 */
export function hasFeatureAccess(
  plan: SubscriptionPlan | string,
  status: SubscriptionStatus | string,
  feature: FeatureKey,
): boolean {
  // During an active trial, all features are unlocked
  if (status === SubscriptionStatus.TRIAL) {
    return true;
  }

  const p = plan as SubscriptionPlan;

  switch (feature) {
    case "EXAMS":
    case "TIMETABLE":
    case "ANALYTICS":
      // Requires PRO or ENTERPRISE
      return p === SubscriptionPlan.PRO || p === SubscriptionPlan.ENTERPRISE;

    case "TRANSPORT":
      // Basic, Pro, and Enterprise include transport
      return (
        p === SubscriptionPlan.BASIC ||
        p === SubscriptionPlan.PRO ||
        p === SubscriptionPlan.ENTERPRISE
      );

    default:
      return true;
  }
}

/**
 * Fetches and evaluates the live subscription for a school.
 */
export async function getSchoolSubscriptionStatus(
  schoolId: string,
): Promise<SubscriptionEvaluation> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      plan: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          trialEndsAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!school) {
    return {
      status: SubscriptionStatus.EXPIRED,
      plan: SubscriptionPlan.FREE,
      isTrial: false,
      isActive: false,
      isPastDue: false,
      isExpired: true,
      daysRemaining: 0,
    };
  }

  const evalResult = evaluateSubscriptionValidity(
    school.subscription || { plan: school.plan },
  );

  return evalResult;
}
