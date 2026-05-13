"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AttendanceRecordSchema = z.object({
  studentId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  remarks: z.string().optional(),
});

const MarkAttendanceSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  date: z.string().min(1, "Date is required"),
  records: z.array(AttendanceRecordSchema).min(1, "At least one record required"),
});

async function getTeacherSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) return null;
  return user;
}

export async function markAttendance(data: unknown) {
  const user = await getTeacherSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = MarkAttendanceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { classId, sectionId, date, records } = parsed.data;
  const attendanceDate = new Date(date);

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId: user.schoolId },
    });
    if (!teacher) return { error: "Teacher record not found" };
    if (teacher.assignedClassId !== classId || teacher.assignedSectionId !== sectionId) {
      return { error: "You can only mark attendance for your assigned class" };
    }
  }

  try {
    const upserts = records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date: attendanceDate } },
        update: { status: r.status, remarks: r.remarks ?? null, markedById: user.id },
        create: {
          schoolId: user.schoolId,
          studentId: r.studentId,
          classId,
          sectionId,
          date: attendanceDate,
          status: r.status,
          remarks: r.remarks ?? null,
          markedById: user.id,
        },
      })
    );

    const results = await prisma.$transaction(upserts);
    revalidatePath("/attendance");
    return { success: true, count: results.length };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getAttendanceForClass(classId: string, sectionId: string, date: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const user = session.user as any;
  if (!user.schoolId) return { error: "No school" };

  try {
    const records = await prisma.attendance.findMany({
      where: {
        schoolId: user.schoolId,
        classId,
        sectionId,
        date: new Date(date),
      },
      select: { studentId: true, status: true, remarks: true },
    });
    return { success: true, records };
  } catch (e: any) {
    return { error: e.message };
  }
}
