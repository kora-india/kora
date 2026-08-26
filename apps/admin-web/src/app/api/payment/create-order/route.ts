import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@schoolos/auth";
import { createLogger } from "@schoolos/logger";
import Razorpay from "razorpay";
import { z } from "zod";

const paymentLogger = createLogger("payment-orders");

const OrderSchema = z.object({
  plan: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
});

const PLAN_PRICES = {
  BASIC: 999,
  PRO: 1999,
  ENTERPRISE: 4999,
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = OrderSchema.parse(body);

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "rzp_secret_placeholder",
    });

    const amountInPaise = PLAN_PRICES[plan] * 100;
    const receipt = `receipt_order_${Date.now()}`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
    };

    const order = await razorpay.orders.create(options);

    paymentLogger.info(
      {
        orderId: order.id,
        plan,
        amount: order.amount,
        userId: session.user.id,
      },
      `[Razorpay Order Created] ${order.id} for plan ${plan}`
    );

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    paymentLogger.error({ err: error }, "Error creating Razorpay order");
    Sentry.captureException(error, {
      tags: { service: "razorpay", action: "create-order" },
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
  }
}
