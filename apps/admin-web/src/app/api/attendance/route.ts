import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isError, requirePermission } from "@/lib/auth-guard";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { z } from "zod";
import { invalidateCache, invalidateStudentsCache } from "@/lib/redis";

const attendanceLogger = createLogger("attendance-api");

const MarkAttendanceSchema = z.object({
  classId: z.string(),
  sectionId: z.string(),
  date: z.string(),
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      remarks: z.string().optional(),
    }),
  ),
});

export async function POST(req: NextRequest) {
  try {
    const access = await requirePermission("attendance", "manage");
    if (isError(access)) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error === "Unauthorized" ? 401 : 403 },
      );
    }
    const user = access;

    const schoolId = user.schoolId;
    const body = await req.json();
    const data = MarkAttendanceSchema.parse(body);

    if (user.role === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id, schoolId },
        include: {
          assignedSections: true,
          classTeacherOf: { select: { id: true } },
        },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: "Teacher record not found" },
          { status: 403 },
        );
      }

      const isDirectMatch =
        teacher.assignedClassId === data.classId &&
        (!teacher.assignedSectionId ||
          teacher.assignedSectionId === data.sectionId);
      const isSectionMatch = teacher.assignedSections.some(
        (as) => as.classId === data.classId && as.sectionId === data.sectionId,
      );
      const isClassTeacher = teacher.classTeacherOf.some(
        (ct) => ct.id === data.classId,
      );

      if (!isDirectMatch && !isSectionMatch && !isClassTeacher) {
        return NextResponse.json(
          {
            error:
              "You can only mark attendance for your assigned classes and sections",
          },
          { status: 403 },
        );
      }
    }

    // Verify class and section belong to school
    const cls = await prisma.class.findFirst({
      where: { id: data.classId, schoolId },
    });
    if (!cls) {
      return NextResponse.json(
        { error: "Class not found in your school" },
        { status: 404 },
      );
    }

    const section = await prisma.section.findFirst({
      where: { id: data.sectionId, classId: data.classId, schoolId },
    });
    if (!section) {
      return NextResponse.json(
        { error: "Section not found for the selected class" },
        { status: 404 },
      );
    }

    // Verify all students belong to this school, class, and section
    const studentIds = data.records.map((r) => r.studentId);
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId,
        classId: data.classId,
        sectionId: data.sectionId,
      },
      select: { id: true },
    });
    if (validStudents.length !== studentIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more students do not belong to the selected class and section",
        },
        { status: 400 },
      );
    }

    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);

    await prisma.$transaction(
      data.records.map((rec) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: rec.studentId, date } },
          update: {
            status: rec.status as any,
            markedById: user.id,
            remarks: rec.remarks,
          },
          create: {
            schoolId,
            studentId: rec.studentId,
            classId: data.classId,
            sectionId: data.sectionId,
            date,
            status: rec.status as any,
            markedById: user.id,
            remarks: rec.remarks,
          },
        }),
      ),
    );

    await Promise.all([
      invalidateStudentsCache(schoolId),
      invalidateCache(`cache:${schoolId}:dashboard`),
    ]);

    attendanceLogger.info(
      {
        schoolId,
        markedCount: data.records.length,
        classId: data.classId,
        date: data.date,
      },
      `[Attendance Marked] ${data.records.length} student records updated`,
    );

    return NextResponse.json({ success: true, count: data.records.length });
  } catch (err) {
    attendanceLogger.error({ err }, "Attendance POST error");
    Sentry.captureException(err, {
      tags: { module: "attendance", action: "mark-attendance" },
    });
    return NextResponse.json(
      { error: "Failed to save attendance" },
      { status: 500 },
    );
  }
}

const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const access = await requirePermission("attendance");
    if (isError(access)) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error === "Unauthorized" ? 401 : 403 },
      );
    }
    const user = access;
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get("limit")) || MAX_PAGE_SIZE),
    );

    const where: any = { schoolId: user.schoolId };
    if (classId) where.classId = classId;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      where.date = d;
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { student: { select: { name: true, rollNumber: true } } },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return NextResponse.json({
      records,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    attendanceLogger.error({ err }, "Attendance GET query failed");
    Sentry.captureException(err, {
      tags: { module: "attendance", action: "get-attendance" },
    });
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 },
    );
  }
}
