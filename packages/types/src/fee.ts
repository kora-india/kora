import { z } from "zod";
import { FeeStatus } from "./enums";

export const FeeSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  studentId: z.string(),
  feeType: z.string(),
  amount: z.number(),
  dueDate: z.date(),
  status: z.nativeEnum(FeeStatus),
  paidAt: z.date().nullable().optional(),
  paidAmount: z.number().nullable().optional(),
  remarks: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Fee = z.infer<typeof FeeSchema>;
