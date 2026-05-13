import { z } from "zod";

export const TeacherSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string(),
  qualification: z.string().optional(),
  assignedClassId: z.string().nullable(),
  assignedSectionId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Teacher = z.infer<typeof TeacherSchema>;
