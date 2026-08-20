import { NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import Razorpay from "razorpay";
import { z } from "zod";

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
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const amountInPaise = PLAN_PRICES[plan] * 100;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
  }
}
