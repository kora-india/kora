import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import {
  schoolCreateRatelimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { z } from "zod";
import crypto from "crypto";
import { seedInitialSchoolData } from "@/lib/onboarding";

const schoolLogger = createLogger("school-create");

const SetupSchema = z.object({
  name: z.string().min(3),
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
  address: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  expectedStudents: z.coerce.number().optional(),
  expectedStaff: z.coerce.number().optional(),
  phone: z.string().min(10),
  email: z.string().email(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  schoolType: z.string().optional(),
  board: z.string().optional(),
  mediumOfInstruction: z.string().optional(),
  establishedYear: z.coerce.number().optional(),
  officeHoursStart: z.string().optional(),
  officeHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
  schoolShift: z.string().optional(),
  workingDays: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  academicSession: z.string().optional(),
  gradingSystem: z.string().optional(),
  plan: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
  razorpay_payment_id: z.string(),
  razorpay_order_id: z.string(),
  razorpay_signature: z.string(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user eligibility (must be SCHOOL_ADMIN without an assigned school)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, schoolId: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role !== "SCHOOL_ADMIN") {
      schoolLogger.warn(
        { userId: currentUser.id, role: currentUser.role },
        "Forbidden: Non-school-admin user attempted to create school",
      );
      return NextResponse.json(
        { error: "Only school admins can create a school" },
        { status: 403 },
      );
    }

    if (currentUser.schoolId !== null) {
      schoolLogger.warn(
        { userId: currentUser.id, schoolId: currentUser.schoolId },
        "Forbidden: User already belongs to an existing school",
      );
      return NextResponse.json(
        { error: "User already belongs to an existing school" },
        { status: 400 },
      );
    }

    const identifier = session.user.id || ip;
    const rateLimitResult = await schoolCreateRatelimit.limit(identifier);
    if (!rateLimitResult.success) {
      schoolLogger.warn({ identifier }, "School creation rate limit exceeded");
      return createRateLimitResponse(
        rateLimitResult,
        "Too many school creation attempts. Please wait an hour before creating another school.",
      );
    }

    const body = await req.json();
    const parsed = SetupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const {
      name,
      subdomain,
      address,
      pincode,
      city,
      state,
      country,
      expectedStudents,
      expectedStaff,
      phone,
      email,
      website,
      logoUrl,
      schoolType,
      board,
      mediumOfInstruction,
      establishedYear,
      officeHoursStart,
      officeHoursEnd,
      timezone,
      schoolShift,
      workingDays,
      classes,
      academicSession,
      gradingSystem,
      plan,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = parsed.data;

    // 1. Verify Razorpay Payment Signature (Fail closed, constant-time)
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpaySecret) {
      schoolLogger.error(
        "RAZORPAY_KEY_SECRET is not configured. Failing closed.",
      );
      return NextResponse.json(
        { error: "Payment verification system configuration error" },
        { status: 500 },
      );
    }

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", razorpaySecret)
      .update(text)
      .digest("hex");

    const genBuf = Buffer.from(generated_signature, "utf8");
    const sigBuf = Buffer.from(razorpay_signature, "utf8");

    if (
      genBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(genBuf, sigBuf)
    ) {
      schoolLogger.warn(
        { subdomain, razorpay_order_id },
        "Invalid Razorpay payment signature",
      );
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 },
      );
    }

    // 2. Validate Order server-side (tied to plan, caller, and not yet consumed)
    const storedOrder = await prisma.subscriptionOrder.findUnique({
      where: { orderId: razorpay_order_id },
    });

    if (!storedOrder) {
      schoolLogger.warn({ razorpay_order_id }, "Payment order not found");
      return NextResponse.json(
        { error: "Payment order not found" },
        { status: 400 },
      );
    }

    if (storedOrder.userId !== session.user.id) {
      schoolLogger.warn(
        {
          razorpay_order_id,
          orderUserId: storedOrder.userId,
          currentUserId: session.user.id,
        },
        "Payment order does not belong to caller",
      );
      return NextResponse.json(
        { error: "Payment order does not belong to caller" },
        { status: 403 },
      );
    }

    if (storedOrder.status !== "PENDING" || storedOrder.paymentId) {
      schoolLogger.warn(
        { razorpay_order_id },
        "Payment order has already been consumed",
      );
      return NextResponse.json(
        { error: "Payment order has already been consumed" },
        { status: 400 },
      );
    }

    if (storedOrder.plan !== plan) {
      schoolLogger.warn(
        { orderPlan: storedOrder.plan, requestedPlan: plan },
        "Plan mismatch between payment order and requested school plan",
      );
      return NextResponse.json(
        {
          error: `Payment order is for plan ${storedOrder.plan}, but requested plan is ${plan}`,
        },
        { status: 400 },
      );
    }

    const existingPayment = await prisma.subscriptionOrder.findUnique({
      where: { paymentId: razorpay_payment_id },
    });
    if (existingPayment) {
      schoolLogger.warn(
        { razorpay_payment_id },
        "Payment ID has already been consumed",
      );
      return NextResponse.json(
        { error: "Payment has already been used for another school" },
        { status: 400 },
      );
    }

    // 3. Check Subdomain Availability
    const existing = await prisma.school.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Subdomain is already taken" },
        { status: 400 },
      );
    }

    // 4. Create School, Subscription & Consume Order Transaction
    const school = await prisma.$transaction(
      async (tx) => {
        // Re-verify user eligibility inside transaction to prevent race conditions
        const txUser = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, role: true, schoolId: true },
        });

        if (
          !txUser ||
          txUser.role !== "SCHOOL_ADMIN" ||
          txUser.schoolId !== null
        ) {
          throw new Error("USER_NOT_ELIGIBLE_FOR_SCHOOL_CREATION");
        }

        // Re-verify order state inside transaction
        const txOrder = await tx.subscriptionOrder.findUnique({
          where: { orderId: razorpay_order_id },
        });

        if (
          !txOrder ||
          txOrder.userId !== session.user.id ||
          txOrder.status !== "PENDING" ||
          txOrder.paymentId ||
          txOrder.plan !== plan
        ) {
          throw new Error("ORDER_INVALID_OR_ALREADY_USED");
        }

        const newSchool = await tx.school.create({
          data: {
            name,
            subdomain,
            address,
            pincode,
            city,
            state,
            country,
            expectedStudents,
            expectedStaff,
            phone,
            email,
            website,
            logoUrl,
            schoolType,
            board,
            mediumOfInstruction,
            establishedYear,
            officeHoursStart,
            officeHoursEnd,
            timezone,
            schoolShift,
            workingDays: workingDays || [],
            gradingSystem,
            plan: plan as any,
          },
        });

        const isPaid = Boolean(razorpay_payment_id && razorpay_order_id);
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const oneMonthLater = new Date(
          new Date().setMonth(new Date().getMonth() + 1),
        );

        await tx.subscription.create({
          data: {
            schoolId: newSchool.id,
            plan: plan as any,
            status: isPaid ? "ACTIVE" : "TRIAL",
            trialEndsAt: isPaid ? null : trialEndsAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: isPaid ? oneMonthLater : trialEndsAt,
          },
        });

        await tx.user.update({
          where: { id: session.user.id },
          data: { schoolId: newSchool.id },
        });

        // Mark the order consumed inside the transaction
        await tx.subscriptionOrder.update({
          where: { id: txOrder.id },
          data: {
            status: "PAID",
            paymentId: razorpay_payment_id,
            schoolId: newSchool.id,
          },
        });

        return newSchool;
      },
      { maxWait: 10000, timeout: 20000 },
    );

    // 5. Prepopulate starter data dynamically using user input
    try {
      await seedInitialSchoolData(prisma, {
        schoolId: school.id,
        subdomain,
        schoolName: name,
        classes,
        academicSession,
      });
    } catch (seedError) {
      schoolLogger.error(
        { err: seedError, schoolId: school.id },
        "Error seeding starter data for new school",
      );
    }

    schoolLogger.info(
      { schoolId: school.id, subdomain, plan, userId: session.user.id },
      `[School Created] ${name} (${subdomain}) on plan ${plan}`,
    );

    return NextResponse.json({ success: true, schoolId: school.id });
  } catch (error) {
    schoolLogger.error({ err: error }, "Error creating school");
    Sentry.captureException(error, {
      tags: { action: "create-school" },
    });

    if (error instanceof Error) {
      if (error.message === "USER_NOT_ELIGIBLE_FOR_SCHOOL_CREATION") {
        return NextResponse.json(
          { error: "User is not eligible to create a school" },
          { status: 400 },
        );
      }
      if (error.message === "ORDER_INVALID_OR_ALREADY_USED") {
        return NextResponse.json(
          { error: "Payment order is invalid or has already been used" },
          { status: 400 },
        );
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
