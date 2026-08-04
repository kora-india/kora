"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function changePassword(data: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = ChangePasswordSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found" };

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!isValid) return { error: "Current password is incorrect" };

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  return { success: true };
}
