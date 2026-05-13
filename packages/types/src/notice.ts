import { z } from "zod";
import { NoticePriority } from "./enums";

export const NoticeSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  title: z.string().min(2),
  content: z.string().min(10),
  priority: z.nativeEnum(NoticePriority),
  targetClassId: z.string().nullable().optional(),
  publishedById: z.string(),
  isPublished: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateNoticeSchema = NoticeSchema.pick({
  title: true,
  content: true,
  priority: true,
  targetClassId: true,
});

export type Notice = z.infer<typeof NoticeSchema>;
export type CreateNoticeInput = z.infer<typeof CreateNoticeSchema>;
