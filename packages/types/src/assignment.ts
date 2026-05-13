import { z } from "zod";

export const AssignmentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  teacherId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.date(),
  fileUrl: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Assignment = z.infer<typeof AssignmentSchema>;
