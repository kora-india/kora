import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { z } from "zod";
import { applyPaidMonth, isValidRazorpaySignature } from "@/lib/billing";
import { isPaidPlan } from "@/lib/plans";
import { invalidateCache, invalidateSuperAdminCache } from "@/lib/redis";

const paymentLogger = createLogger("payment-verify");

const VerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Confirms a renewal payment and adds the paid month to the school (U2). Safe
 * to call twice with the same payment: the second call reports success
 * without adding another month.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = VerifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment details" },
        { status: 400 },
      );
    }
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = parsed.data;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      paymentLogger.error(
        "RAZORPAY_KEY_SECRET is not configured. Failing closed.",
      );
      return NextResponse.json(
        { error: "Payment verification system configuration error" },
        { status: 500 },
      );
    }
    if (!isValidRazorpaySignature(orderId, paymentId, signature, secret)) {
      paymentLogger.warn({ orderId }, "Invalid Razorpay payment signature");
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 },
      );
    }

    const order = await prisma.subscriptionOrder.findUnique({
      where: { orderId },
    });
    if (
      !order ||
      order.purpose !== "RENEWAL" ||
      order.userId !== session.user.id ||
      !order.schoolId ||
      !isPaidPlan(order.plan)
    ) {
      paymentLogger.warn(
        { orderId, userId: session.user.id },
        "Renewal order not found or not the caller's",
      );
      return NextResponse.json(
        { error: "Payment order not found" },
        { status: 400 },
      );
    }
    if (order.status === "COMPLETED") {
      if (order.paymentId === paymentId) {
        return NextResponse.json({ success: true, alreadyApplied: true });
      }
      return NextResponse.json(
        { error: "This payment order has already been used" },
        { status: 400 },
      );
    }

    const schoolId = order.schoolId;
    const plan = order.plan;
    const subscription = await prisma.$transaction(async (tx) => {
      // Claims the order; a concurrent call for the same order finds it gone.
      const claimed = await tx.subscriptionOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "COMPLETED", paymentId },
      });
      if (claimed.count === 0) throw new Error("ORDER_ALREADY_USED");
      return applyPaidMonth(tx, schoolId, plan);
    });

    await Promise.all([
      invalidateCache(`cache:${schoolId}:school:*`),
      invalidateCache(`cache:${schoolId}:dashboard`),
      invalidateSuperAdminCache(),
    ]);

    paymentLogger.info(
      { orderId, schoolId, plan, periodEnd: subscription.currentPeriodEnd },
      `[Subscription Renewed] ${schoolId} on ${plan}`,
    );

    return NextResponse.json({
      success: true,
      plan,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  } catch (error: any) {
    if (error?.message === "ORDER_ALREADY_USED" || error?.code === "P2002") {
      return NextResponse.json(
        { error: "This payment has already been applied" },
        { status: 400 },
      );
    }
    paymentLogger.error({ err: error }, "Error verifying renewal payment");
    Sentry.captureException(error, {
      tags: { service: "razorpay", action: "verify-renewal" },
    });
    return NextResponse.json(
      {
        error:
          "We couldn't confirm the payment. If you were charged, contact support.",
      },
      { status: 500 },
    );
  }
}
