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
import { seedStarterData } from "@/lib/onboarding";
import {
  applyPaidMonth,
  isSubdomainAvailable,
  isValidRazorpaySignature,
} from "@/lib/billing";
import { TRIAL_PLAN } from "@/lib/plans";
import { TRIAL_DURATION_DAYS } from "@/lib/subscription";
import { resolveTimeZone } from "@/lib/fees/timezone";

const GRADING_SYSTEMS = ["CBSE_9_POINT", "PERCENTAGE_LETTER", "MARKS_ONLY"];
import { invalidateSuperAdminCache } from "@/lib/redis";

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
  // U2: a trial needs no payment; anything else must carry one.
  trial: z.boolean().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_order_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export async function POST(req: Request) {
  // Set once a paid request's payment is recorded, so errors can say so.
  let paymentSaved = false;
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
      trial,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = parsed.data;
    const isTrial = trial === true;
    // A trial runs on the plan with every feature (see hasFeatureAccess).
    const plan = isTrial ? TRIAL_PLAN : parsed.data.plan;

    let paidOrderId: string | null = null;
    if (!isTrial) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json(
          { error: "Payment details are missing" },
          { status: 400 },
        );
      }

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
      if (
        !isValidRazorpaySignature(
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          razorpaySecret,
        )
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

      if (!storedOrder || storedOrder.purpose !== "SETUP") {
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

      // U3: a PAID order whose school was never created may be used again,
      // but only with the payment that paid it.
      const retryingPaidOrder =
        storedOrder.status === "PAID" &&
        storedOrder.paymentId === razorpay_payment_id &&
        storedOrder.schoolId === null;
      if (storedOrder.status !== "PENDING" && !retryingPaidOrder) {
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

      if (!retryingPaidOrder) {
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

        // U3: record the payment now, before anything else can fail, so a
        // failed creation can be retried with it and support can see it.
        const recorded = await prisma.subscriptionOrder.updateMany({
          where: { id: storedOrder.id, status: "PENDING" },
          data: { status: "PAID", paymentId: razorpay_payment_id },
        });
        if (recorded.count === 0) {
          return NextResponse.json(
            { error: "Payment order has already been consumed" },
            { status: 400 },
          );
        }
        schoolLogger.info(
          { razorpay_order_id, userId: session.user.id, plan },
          "Setup payment recorded",
        );
      }
      paidOrderId = storedOrder.id;
    }

    // From here a paid request has its payment saved; failures say so, and
    // the setup page retries with the same payment instead of charging again.
    paymentSaved = paidOrderId !== null;

    // 3. Check Subdomain Availability (schools and other payers' holds)
    if (!(await isSubdomainAvailable(subdomain, session.user.id))) {
      return NextResponse.json(
        {
          error: paymentSaved
            ? "Subdomain is already taken. Choose another one to finish setup; your payment is saved."
            : "Subdomain is already taken",
          code: "SUBDOMAIN_TAKEN",
          paymentSaved,
        },
        { status: 409 },
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
        const txOrder = paidOrderId
          ? await tx.subscriptionOrder.findUnique({
              where: { id: paidOrderId },
            })
          : null;

        if (
          paidOrderId &&
          (!txOrder ||
            txOrder.userId !== session.user.id ||
            txOrder.status !== "PAID" ||
            txOrder.paymentId !== razorpay_payment_id ||
            txOrder.schoolId !== null ||
            txOrder.plan !== plan)
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
            // U6: an IANA name ("Asia/Kolkata"), never "Asia/Kolkata (IST)".
            timezone: resolveTimeZone(timezone),
            schoolShift,
            workingDays: workingDays || [],
            gradingSystem: GRADING_SYSTEMS.includes(gradingSystem as any)
              ? gradingSystem
              : null,
            plan,
          },
        });

        if (isTrial) {
          const trialEndsAt = new Date(
            Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
          );
          await tx.subscription.create({
            data: {
              schoolId: newSchool.id,
              plan,
              status: "TRIAL",
              trialEndsAt,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndsAt,
            },
          });
        } else {
          await applyPaidMonth(tx, newSchool.id, plan);
        }

        await tx.user.update({
          where: { id: session.user.id },
          data: { schoolId: newSchool.id },
        });

        // Mark the order consumed inside the transaction
        if (txOrder) {
          await tx.subscriptionOrder.update({
            where: { id: txOrder.id },
            data: { status: "COMPLETED", schoolId: newSchool.id, subdomain },
          });
        }

        return newSchool;
      },
      { maxWait: 10000, timeout: 20000 },
    );

    // 5. Prepopulate starter data dynamically using user input. U6: all or
    // nothing, tried twice, and a failure is reported instead of swallowed.
    let starterDataError: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await seedStarterData(prisma, {
          schoolId: school.id,
          subdomain,
          schoolName: name,
          classes,
          academicSession,
        });
        starterDataError = null;
        break;
      } catch (seedError) {
        schoolLogger.error(
          { err: seedError, schoolId: school.id, attempt },
          "Error seeding starter data for new school",
        );
        starterDataError =
          "Your school is ready, but we couldn't add its classes, academic session and fee setup.";
      }
    }

    schoolLogger.info(
      { schoolId: school.id, subdomain, plan, userId: session.user.id },
      `[School Created] ${name} (${subdomain}) on plan ${plan}`,
    );

    await invalidateSuperAdminCache();

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      ...(starterDataError ? { starterDataError } : {}),
    });
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
      // Lost a race for the subdomain: the payment stays saved for a retry.
      if ((error as any).code === "P2002") {
        return NextResponse.json(
          {
            error:
              "Subdomain is already taken. Choose another one to finish setup.",
            code: "SUBDOMAIN_TAKEN",
            paymentSaved,
          },
          { status: 409 },
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
