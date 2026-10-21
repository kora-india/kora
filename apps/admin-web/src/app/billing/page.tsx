import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { BillingContent } from "@/components/billing/billing-content";
import { evaluateSubscriptionValidity } from "@/lib/subscription";
import { isPaidPlan } from "@/lib/plans";

export const metadata = { title: "Plan & Billing — Kora" };

/**
 * A school's plan and payments (U2). Outside the dashboard layout on purpose:
 * that layout sends expired schools to /expired, which links here.
 */
export default async function BillingPage(props: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (user.role === "SUPER_ADMIN") redirect("/subscriptions");
  if (!user.schoolId) {
    redirect(user.role === "SCHOOL_ADMIN" ? "/setup" : "/login");
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: {
      name: true,
      plan: true,
      isActive: true,
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
  if (!school) redirect("/login");
  if (!school.isActive) redirect("/suspended");

  const evaluation = evaluateSubscriptionValidity(
    school.subscription || { plan: school.plan },
  );
  const { plan } = (await props.searchParams) ?? {};

  return (
    <BillingContent
      schoolName={school.name}
      canPay={user.role === "SCHOOL_ADMIN"}
      status={{
        plan: evaluation.plan,
        isTrial: evaluation.isTrial && !evaluation.isExpired,
        isPastDue: evaluation.isPastDue,
        isExpired: evaluation.isExpired,
        daysRemaining: Number.isFinite(evaluation.daysRemaining)
          ? evaluation.daysRemaining
          : null,
        trialEndsAt: school.subscription?.trialEndsAt?.toISOString() ?? null,
        periodEnd: school.subscription?.currentPeriodEnd?.toISOString() ?? null,
      }}
      suggestedPlan={plan && isPaidPlan(plan) ? plan : null}
    />
  );
}
