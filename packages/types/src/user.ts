import { z } from "zod";
import { UserRole } from "./enums";

export const UserSchema = z.object({
  id: z.string(),
  schoolId: z.string().nullable(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(UserRole),
  image: z.string().url().nullable().optional(),
  phone: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Changing your own password: in Settings, or the first time you sign in. */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password different from the current one",
    path: ["newPassword"],
  });

export type User = z.infer<typeof UserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string | null;
  image?: string | null;
  mustChangePassword?: boolean;
}
