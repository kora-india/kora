import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import {
  otpRatelimit,
  otpIpRatelimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import crypto from "crypto";
import { z } from "zod";

const authLogger = createLogger("auth-send-otp");

const SendOtpSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { email } = SendOtpSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate limit by IP across all requests to prevent spray attacks
    const ipRateLimit = await otpIpRatelimit.limit(ip);
    if (!ipRateLimit.success) {
      authLogger.warn({ ip }, "OTP rate limit exceeded for IP");
      return createRateLimitResponse(
        ipRateLimit,
        "Too many requests from this network. Please wait a few minutes before trying again.",
      );
    }

    // 2. Rate limit per recipient email
    const emailRateLimit = await otpRatelimit.limit(normalizedEmail);
    if (!emailRateLimit.success) {
      authLogger.warn(
        { ip, email: normalizedEmail },
        "OTP rate limit exceeded for Email",
      );
      return createRateLimitResponse(
        emailRateLimit,
        "Too many verification codes requested for this email. Please wait a few minutes before trying again.",
      );
    }

    const hasSmtp = isMailConfigured();

    // In production, fail early if SMTP is missing
    if (process.env.NODE_ENV === "production" && !hasSmtp) {
      authLogger.error(
        "SMTP service is unconfigured in production environment",
      );
      return NextResponse.json(
        {
          error:
            "Email delivery service is currently unavailable. Please contact support.",
        },
        { status: 503 },
      );
    }

    // Check if user already exists — return uniform message to prevent account enumeration
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      authLogger.warn(
        { email: normalizedEmail },
        "Registration OTP requested for an already registered email",
      );
      return NextResponse.json({
        success: true,
        message:
          "If your email is eligible, a verification code has been sent.",
      });
    }

    // Generate a cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save hashed OTP to DB (cleanup old ones if they exist for this email)
    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
    await prisma.otp.create({
      data: {
        email: normalizedEmail,
        otp: hashedOtp,
        expiresAt,
      },
    });

    // Log OTP to server console in development or if SMTP is not configured
    if (process.env.NODE_ENV === "development" || !hasSmtp) {
      authLogger.info(
        { email: normalizedEmail, otpMasked: "***" },
        `[DEV OTP Generated] Verification code issued for ${normalizedEmail}`,
      );
    }

    // Send email using Nodemailer if SMTP credentials are provided
    if (hasSmtp) {
      const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #6d28d9; text-align: center;">Welcome to Kora!</h2>
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #333;">Thank you for registering. Please use the following One-Time Password (OTP) to complete your registration process:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #6d28d9; letter-spacing: 5px; background: #f3e8ff; padding: 15px 25px; border-radius: 8px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #666; text-align: center;">This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">If you did not request this email, you can safely ignore it.</p>
        </div>
      `;

      const sent = await sendMail({
        to: normalizedEmail,
        subject: "Your Kora Verification Code",
        html: htmlTemplate,
      });
      if (!sent.success) {
        authLogger.error(
          { err: sent.error, email: normalizedEmail },
          "Failed to dispatch OTP email",
        );
        // A code the user never received must not linger as the valid one.
        await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
        return NextResponse.json(
          { error: "Failed to dispatch verification email. Please try again." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "If your email is eligible, a verification code has been sent.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 },
      );
    }
    authLogger.error({ err: error }, "Failed to generate or send OTP");
    Sentry.captureException(error, {
      tags: { action: "send-otp" },
    });
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
