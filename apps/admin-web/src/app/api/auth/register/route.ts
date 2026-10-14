import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { authRatelimit, createRateLimitResponse } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

const registerLogger = createLogger("auth-register");

const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(20, "Name cannot exceed 20 characters"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  otp: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { name, email, password, otp } = RegisterSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate limit by IP
    const ipRateLimit = await authRatelimit.limit(ip);
    if (!ipRateLimit.success) {
      registerLogger.warn({ ip }, "Registration rate limit exceeded for IP");
      return createRateLimitResponse(
        ipRateLimit,
        "Too many registration attempts. Please wait 15 minutes before trying again.",
      );
    }

    // 2. Rate limit OTP verification attempts by target email
    const emailRateLimit = await authRatelimit.limit(
      `register:email:${normalizedEmail}`,
    );
    if (!emailRateLimit.success) {
      registerLogger.warn(
        { ip, email: normalizedEmail },
        "Registration attempt limit exceeded for Email",
      );
      return createRateLimitResponse(
        emailRateLimit,
        "Too many attempts for this email. Please request a new OTP or wait 15 minutes.",
      );
    }

    // 3. Verify OTP (compare SHA-256 hash with fallback to plaintext)
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        OR: [{ otp: hashedOtp }, { otp }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      registerLogger.warn(
        { email: normalizedEmail },
        "Registration failed: Invalid OTP provided",
      );
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (otpRecord.expiresAt < new Date()) {
      registerLogger.warn(
        { email: normalizedEmail },
        "Registration failed: Expired OTP provided",
      );
      return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
    }

    // 4. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      registerLogger.warn(
        { email: normalizedEmail },
        "Registration failed: Email already registered",
      );
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 400 },
      );
    }

    // 5. Create user
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "SCHOOL_ADMIN",
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    // 4. Cleanup OTP
    await prisma.otp.deleteMany({ where: { email } });

    registerLogger.info(
      { userId: user.id, email: user.email, role: user.role },
      `[User Registered] New school admin registered successfully: ${user.email}`,
    );

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 },
      );
    }
    registerLogger.error({ err: error }, "Error in user registration");
    Sentry.captureException(error, {
      tags: { action: "register-user" },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
