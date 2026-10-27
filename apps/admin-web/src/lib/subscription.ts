import { prisma, SubscriptionPlan, SubscriptionStatus } from "@schoolos/db";
import {
  TRIAL_DURATION_DAYS,
  getPlan,
  planIncludes,
  type FeatureKey,
  type PlanCatalog,
} from "@/lib/plans";

export type { FeatureKey };

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
export { TRIAL_DURATION_DAYS };

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

  // D16: a status stored as EXPIRED is final, even with no period end set
  // (this used to fall through and evaluate as ACTIVE).
  if (rawStatus === SubscriptionStatus.EXPIRED) {
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

  // If status is explicitly CANCELLED in database
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

  // PAST_DUE with no period end: we can't time the grace period, so keep
  // access but report it as past due instead of quietly ACTIVE.
  if (!periodEnd && rawStatus === SubscriptionStatus.PAST_DUE) {
    return {
      status: SubscriptionStatus.PAST_DUE,
      plan,
      isTrial: false,
      isActive: true,
      isPastDue: true,
      isExpired: false,
      daysRemaining: 0,
      message: "Billing past due. Please renew to avoid interruption.",
    };
  }

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
 * Whether the plan unlocks `feature`, per the live catalogue (`getPlanCatalog()`).
 * During an active TRIAL every feature is unlocked.
 */
export function hasFeatureAccess(
  plan: SubscriptionPlan | string,
  status: SubscriptionStatus | string,
  feature: FeatureKey,
  plans: PlanCatalog,
): boolean {
  if (status === SubscriptionStatus.TRIAL) {
    return true;
  }
  return planIncludes(getPlan(plans, plan), feature);
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
