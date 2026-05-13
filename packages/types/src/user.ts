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
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type User = z.infer<typeof UserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string | null;
  image?: string | null;
}
