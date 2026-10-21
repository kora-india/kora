import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { paymentRatelimit, createRateLimitResponse } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import Razorpay from "razorpay";
import { z } from "zod";
import { planAmountPaise } from "@/lib/plans";
import { isSubdomainAvailable } from "@/lib/billing";

const paymentLogger = createLogger("payment-orders");

const OrderSchema = z.object({
  plan: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
  // SETUP pays for a new school; RENEWAL pays another month (or ends a trial).
  purpose: z.enum(["SETUP", "RENEWAL"]).default("SETUP"),
  // Setup only: checked again here and held for this user during checkout.
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user eligibility (must be SCHOOL_ADMIN without an assigned school)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, schoolId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "SCHOOL_ADMIN") {
      paymentLogger.warn(
        { userId: user.id, role: user.role },
        "Forbidden: Non-school-admin user attempted to create payment order",
      );
      return NextResponse.json(
        { error: "Only school admins can create a subscription order" },
        { status: 403 },
      );
    }

    const { plan, purpose, subdomain } = OrderSchema.parse(await req.json());

    if (purpose === "SETUP" && user.schoolId !== null) {
      paymentLogger.warn(
        { userId: user.id, schoolId: user.schoolId },
        "Forbidden: User already belongs to an existing school",
      );
      return NextResponse.json(
        { error: "User already belongs to an existing school" },
        { status: 400 },
      );
    }
    if (purpose === "RENEWAL" && user.schoolId === null) {
      return NextResponse.json(
        { error: "Create your school before renewing a plan" },
        { status: 400 },
      );
    }

    const identifier = session.user.id || ip;
    const rateLimitResult = await paymentRatelimit.limit(identifier);
    if (!rateLimitResult.success) {
      paymentLogger.warn(
        { identifier },
        "Payment order creation rate limit exceeded",
      );
      return createRateLimitResponse(
        rateLimitResult,
        "Too many payment requests. Please wait a moment before trying again.",
      );
    }

    // U3: check the subdomain again right before checkout; the order then
    // holds it for this user so no one can take it while they pay.
    if (
      purpose === "SETUP" &&
      subdomain &&
      !(await isSubdomainAvailable(subdomain, user.id))
    ) {
      return NextResponse.json(
        { error: "This subdomain was just taken. Choose another one." },
        { status: 409 },
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      paymentLogger.error(
        "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured. Failing closed.",
      );
      return NextResponse.json(
        { error: "Payment gateway is not configured" },
        { status: 500 },
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const amountInPaise = planAmountPaise(plan);
    const receipt = `receipt_order_${Date.now()}`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
    };

    const order = await razorpay.orders.create(options);

    // Store order server-side with user, plan, amount and PENDING status
    await prisma.subscriptionOrder.create({
      data: {
        orderId: order.id,
        userId: session.user.id,
        plan,
        amount: Number(order.amount),
        currency: order.currency,
        status: "PENDING",
        purpose,
        subdomain: purpose === "SETUP" ? (subdomain ?? null) : null,
        schoolId: purpose === "RENEWAL" ? user.schoolId : null,
      },
    });

    paymentLogger.info(
      {
        orderId: order.id,
        plan,
        purpose,
        amount: order.amount,
        userId: session.user.id,
      },
      `[Razorpay Order Created] ${order.id} for plan ${plan}`,
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
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 },
    );
  }
}
