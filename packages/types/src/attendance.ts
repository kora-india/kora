import { z } from "zod";
import { AttendanceStatus } from "./enums";

export const AttendanceSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  studentId: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  date: z.date(),
  status: z.nativeEnum(AttendanceStatus),
  markedById: z.string(),
  remarks: z.string().optional(),
  createdAt: z.date(),
});

export const MarkAttendanceSchema = z.object({
  classId: z.string(),
  sectionId: z.string(),
  date: z.string(),
  records: z.array(z.object({
    studentId: z.string(),
    status: z.nativeEnum(AttendanceStatus),
    remarks: z.string().optional(),
  })),
});

export type Attendance = z.infer<typeof AttendanceSchema>;
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>;
