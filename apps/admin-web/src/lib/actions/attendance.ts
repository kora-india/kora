"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCache, invalidateStudentsCache } from "@/lib/redis";

const AttendanceRecordSchema = z.object({
  studentId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  remarks: z.string().optional(),
});

const MarkAttendanceSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  date: z.string().min(1, "Date is required"),
  records: z
    .array(AttendanceRecordSchema)
    .min(1, "At least one record required"),
});

async function getTeacherSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role))
    return null;
  return { ...user, schoolId: user.schoolId };
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
      include: {
        assignedSections: true,
        classTeacherOf: { select: { id: true } },
      },
    });
    if (!teacher) return { error: "Teacher record not found" };

    const isDirectMatch =
      teacher.assignedClassId === classId &&
      (!teacher.assignedSectionId || teacher.assignedSectionId === sectionId);
    const isSectionMatch = teacher.assignedSections.some(
      (as) => as.classId === classId && as.sectionId === sectionId,
    );
    const isClassTeacher = teacher.classTeacherOf.some(
      (ct) => ct.id === classId,
    );

    if (!isDirectMatch && !isSectionMatch && !isClassTeacher) {
      return {
        error:
          "You can only mark attendance for your assigned classes and sections",
      };
    }
  }

  // Cross-tenant verification: verify class and section belong to school
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) return { error: "Class not found in your school" };

  const section = await prisma.section.findFirst({
    where: { id: sectionId, classId, schoolId: user.schoolId },
  });
  if (!section) return { error: "Section not found for the selected class" };

  // Verify all students belong to this school, class, and section
  const studentIds = records.map((r) => r.studentId);
  const validStudents = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId: user.schoolId,
      classId,
      sectionId,
    },
    select: { id: true },
  });
  if (validStudents.length !== studentIds.length) {
    return {
      error:
        "One or more students do not belong to the selected class and section",
    };
  }

  try {
    const upserts = records.map((r) =>
      prisma.attendance.upsert({
        where: {
          studentId_date: { studentId: r.studentId, date: attendanceDate },
        },
        update: {
          status: r.status,
          remarks: r.remarks ?? null,
          markedById: user.id,
        },
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
      }),
    );

    const results = await prisma.$transaction(upserts);
    await Promise.all([
      invalidateStudentsCache(user.schoolId),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return { success: true, count: results.length };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getAttendanceForClass(
  classId: string,
  sectionId: string,
  date: string,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const user = session.user;
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
