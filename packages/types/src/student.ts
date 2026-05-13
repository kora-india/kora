import { z } from "zod";

export const StudentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  rollNumber: z.string(),
  admissionNumber: z.string(),
  name: z.string().min(2),
  dateOfBirth: z.date().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  parentName: z.string(),
  parentPhone: z.string(),
  parentEmail: z.string().email().optional(),
  address: z.string().optional(),
  photoUrl: z.string().url().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateStudentSchema = StudentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Student = z.infer<typeof StudentSchema>;
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
