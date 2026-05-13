import { z } from "zod";
import { SubscriptionPlan } from "./enums";

export const SchoolSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  subdomain: z.string().min(2).max(50),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logoUrl: z.string().url().optional(),
  plan: z.nativeEnum(SubscriptionPlan),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateSchoolSchema = SchoolSchema.pick({
  name: true,
  subdomain: true,
  address: true,
  phone: true,
  email: true,
  plan: true,
});

export type School = z.infer<typeof SchoolSchema>;
export type CreateSchoolInput = z.infer<typeof CreateSchoolSchema>;
