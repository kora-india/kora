import { NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { z } from "zod";
import crypto from "crypto";

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
    } = SetupSchema.parse(body);

    // Verify Razorpay Signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Check if subdomain is taken
    const existingSchool = await prisma.school.findUnique({ where: { subdomain } });
    if (existingSchool) {
      return NextResponse.json({ error: "Subdomain is already taken" }, { status: 400 });
    }

    // Create the school and subscription in a transaction
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

    return NextResponse.json({ success: true, schoolId: school.id });
  } catch (error) {
    console.error("Error creating school:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

