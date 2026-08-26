import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { z } from "zod";
import crypto from "crypto";

const schoolLogger = createLogger("school-create");

const SetupSchema = z.object({
  name: z.string().min(3),
  subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/),
  address: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  expectedStudents: z.coerce.number().optional(),
  expectedStaff: z.coerce.number().optional(),
  phone: z.string().min(10),
  email: z.string().email(),
  plan: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
  razorpay_payment_id: z.string(),
  razorpay_order_id: z.string(),
  razorpay_signature: z.string(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = SetupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
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
      plan,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = parsed.data;

    // 1. Verify Razorpay Payment Signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dummy_secret")
      .update(text)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      schoolLogger.warn({ subdomain, razorpay_order_id }, "Invalid Razorpay payment signature");
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    // 2. Check Subdomain Availability
    const existing = await prisma.school.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return NextResponse.json({ error: "Subdomain is already taken" }, { status: 400 });
    }

    // 3. Create School & Initial Subscription Transaction
    const school = await prisma.$transaction(async (tx) => {
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
          plan: plan as any,
        },
      });

      await tx.subscription.create({
        data: {
          schoolId: newSchool.id,
          plan: plan as any,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)), // 1 month validity
        },
      });

      await tx.user.update({
        where: { id: session.user.id },
        data: { schoolId: newSchool.id },
      });

      return newSchool;
    });

    schoolLogger.info(
      { schoolId: school.id, subdomain, plan, userId: session.user.id },
      `[School Created] ${name} (${subdomain}) on plan ${plan}`
    );

    return NextResponse.json({ success: true, schoolId: school.id });
  } catch (error) {
    schoolLogger.error({ err: error }, "Error creating school");
    Sentry.captureException(error, {
      tags: { action: "create-school" },
    });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
