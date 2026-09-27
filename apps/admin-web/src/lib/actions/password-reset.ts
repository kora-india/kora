"use server";

import { prisma } from "@schoolos/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { logger } from "@/lib/logger";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const RequestResetSchema = z.object({
  email: z.string().email("Valid email required"),
});

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset link is invalid"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function requestPasswordReset(data: unknown) {
  const parsed = RequestResetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user) {
    return {
      error:
        "No account found with this email address. Please check for typos or create an account.",
    };
  }
  if (!user.isActive) {
    return {
      error: "This account has been deactivated. Please contact support.",
    };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry },
  });

  const baseUrl = process.env.NEXTAUTH_URL;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

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
    message: "A password reset link has been sent to your email.",
  };
}

export async function resetPassword(data: unknown) {
  const parsed = ResetPasswordSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.findUnique({
    where: { resetToken: parsed.data.token },
  });
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return {
      error:
        "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null },
  });

  return { success: true };
}
