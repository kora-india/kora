"use server";

import { prisma } from "@schoolos/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { appUrl, sendPasswordResetEmail } from "@/lib/mailer";
import { logger } from "@/lib/logger";
import { passwordResetRatelimit } from "@/lib/ratelimit";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const RequestResetSchema = z.object({
  email: z.string().email("Valid email required"),
});

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset link is invalid"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function requestPasswordReset(data: unknown) {
  const parsed = RequestResetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const email = parsed.data.email.toLowerCase().trim();

  // Rate limiting by IP and email
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown";

    const [ipLimit, emailLimit] = await Promise.all([
      passwordResetRatelimit.limit(`pwreset:ip:${ip}`),
      passwordResetRatelimit.limit(`pwreset:email:${email}`),
    ]);

    if (!ipLimit.success || !emailLimit.success) {
      return {
        error:
          "Too many password reset requests. Please wait 15 minutes before trying again.",
      };
    }
  } catch (e) {
    logger.warn("Failed to evaluate password reset rate limit", {
      err: String(e),
    });
  }

  // Uniform response message to prevent account enumeration
  const uniformSuccessMessage =
    "If an account is associated with this email address, a password reset link has been sent.";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // The super admin's password comes from SUPER_ADMIN_PASSWORD, so no link
  // is sent; the reply is the same so the account isn't revealed.
  if (!user || !user.isActive || user.role === "SUPER_ADMIN") {
    // The server log says why, without the address; the person doesn't.
    logger.info("Password reset requested; no email sent", {
      reason: !user
        ? "no account uses this email"
        : !user.isActive
          ? "login is turned off"
          : "super admin",
    });
    // Return success message silently without sending email to prevent user enumeration
    return {
      success: true,
      message: uniformSuccessMessage,
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: hashedToken, resetTokenExpiry },
  });

  const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`;

  const emailResult = await sendPasswordResetEmail(user.email, resetUrl);
  if (!emailResult.success) {
    logger.error("Password reset email failed to send", {
      userId: user.id,
      error: emailResult.error,
    });
    return {
      error:
        "Failed to dispatch reset email. Please check SMTP settings or try again.",
    };
  }

  return {
    success: true,
    message: uniformSuccessMessage,
  };
}

export async function resetPassword(data: unknown) {
  const parsed = ResetPasswordSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const rawToken = parsed.data.token.trim();
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // Support hashed token with fallback to raw token for backward compatibility
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ resetToken: hashedToken }, { resetToken: rawToken }],
    },
  });

  if (
    !user ||
    user.role === "SUPER_ADMIN" ||
    !user.resetTokenExpiry ||
    user.resetTokenExpiry < new Date()
  ) {
    return {
      error:
        "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return { success: true };
}
