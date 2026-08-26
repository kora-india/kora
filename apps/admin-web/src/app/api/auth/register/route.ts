import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerLogger = createLogger("auth-register");

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  otp: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, otp } = RegisterSchema.parse(body);

    // 1. Verify OTP
    const otpRecord = await prisma.otp.findFirst({
      where: { email, otp },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      registerLogger.warn({ email }, "Registration failed: Invalid OTP provided");
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (otpRecord.expiresAt < new Date()) {
      registerLogger.warn({ email }, "Registration failed: Expired OTP provided");
      return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
    }

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      registerLogger.warn({ email }, "Registration failed: Email already registered");
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // 3. Create user
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "SCHOOL_ADMIN",
      },
    });

    // 4. Cleanup OTP
    await prisma.otp.deleteMany({ where: { email } });

    registerLogger.info(
      { userId: user.id, email: user.email, role: user.role },
      `[User Registered] New school admin registered successfully: ${user.email}`
    );

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }
    registerLogger.error({ err: error }, "Error in user registration");
    Sentry.captureException(error, {
      tags: { action: "register-user" },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
