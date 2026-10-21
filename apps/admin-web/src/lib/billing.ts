import crypto from "crypto";
import { prisma, type Prisma } from "@schoolos/db";
import type { PaidPlanId } from "@/lib/plans";

/**
 * Subscription payments (U2, U3).
 *
 * A setup order reserves its subdomain for the payer, and the payment is
 * recorded the moment it is verified (status PAID), so if creating the school
 * then fails the same payment can be used again instead of charging twice.
 * Renewal orders pay another month for an existing school, which is how a
 * trial becomes a paid plan.
 */

/** How long an unpaid checkout keeps its subdomain. */
export const RESERVATION_MINUTES = 30;

export type OrderPurpose = "SETUP" | "RENEWAL";

/** True when the Razorpay signature matches (constant time). */
export function isValidRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(
    crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex"),
    "utf8",
  );
  const given = Buffer.from(signature, "utf8");
  return (
    expected.length === given.length && crypto.timingSafeEqual(expected, given)
  );
}

/**
 * Whether `userId` may use `subdomain`: no school has it, and no one else
 * holds it with a recent checkout or a payment that hasn't created a school.
 */
export async function isSubdomainAvailable(
  subdomain: string,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const [school, reservation] = await Promise.all([
    prisma.school.findUnique({ where: { subdomain }, select: { id: true } }),
    prisma.subscriptionOrder.findFirst({
      where: {
        subdomain,
        purpose: "SETUP",
        userId: { not: userId },
        schoolId: null,
        OR: [
          { status: "PAID" },
          {
            status: "PENDING",
            createdAt: {
              gte: new Date(now.getTime() - RESERVATION_MINUTES * 60_000),
            },
          },
        ],
      },
      select: { id: true },
    }),
  ]);
  return !school && !reservation;
}

/** Same day next month, or the month's last day ("31 Jan" → "28 Feb"). */
export function addOneMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/**
 * The month a payment buys. A school still inside a paid period gets the
 * month added to its end, and one paying during its trial keeps the free
 * days left (the paid month starts when the trial would have ended). A
 * lapsed plan or a new school starts today. A new plan applies at once.
 */
export function nextPaidPeriod(
  current: {
    status?: string | null;
    trialEndsAt?: Date | null;
    currentPeriodEnd?: Date | null;
  } | null,
  now = new Date(),
): { start: Date; end: Date; extended: boolean } {
  const extended = Boolean(
    current?.status === "ACTIVE" &&
    current.currentPeriodEnd &&
    current.currentPeriodEnd > now,
  );
  const trialLeft =
    current?.status === "TRIAL" &&
    current.trialEndsAt &&
    current.trialEndsAt > now
      ? current.trialEndsAt
      : null;
  const start = extended ? current!.currentPeriodEnd! : (trialLeft ?? now);
  return { start, end: addOneMonth(start), extended };
}

/** Applies one paid month of `plan` to the school (inside the caller's transaction). */
export async function applyPaidMonth(
  tx: Prisma.TransactionClient,
  schoolId: string,
  plan: PaidPlanId,
  now = new Date(),
) {
  const current = await tx.subscription.findUnique({ where: { schoolId } });
  const { end, extended } = nextPaidPeriod(current, now);
  const data = {
    plan,
    status: "ACTIVE" as const,
    trialEndsAt: null,
    // An extended period keeps its original start; a new one starts now.
    currentPeriodStart: extended ? (current?.currentPeriodStart ?? now) : now,
    currentPeriodEnd: end,
    cancelledAt: null,
    cancelReason: null,
  };
  const subscription = current
    ? await tx.subscription.update({ where: { schoolId }, data })
    : await tx.subscription.create({ data: { schoolId, ...data } });
  await tx.school.update({ where: { id: schoolId }, data: { plan } });
  return subscription;
}
