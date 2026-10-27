import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/permissions";
import { attendanceDateError, parseAttendanceDate } from "@schoolos/utils";
import { z } from "zod";
import { canTakeSection, getTeacherSections } from "@/lib/teacher-sections";

const Schema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  date: z.string().min(1),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      }),
    )
    .min(1, "No students to save"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;
  if (!user.schoolId)
    return NextResponse.json({ error: "No school" }, { status: 403 });
  if (!can(await getPermissions(), "attendance", "manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const schoolId = user.schoolId;

  // U8: bad input is the caller's mistake (400), not a server error.
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid attendance" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  // U13: a real day, not after today in the school's time zone.
  const dateError = attendanceDateError(data.date, school?.timezone);
  if (dateError) {
    return NextResponse.json({ error: dateError }, { status: 400 });
  }
  // Stored at UTC midnight of the calendar day, like the admin app.
  const date = parseAttendanceDate(data.date)!;

  // Verify class and section belong to school
  const section = await prisma.section.findFirst({
    where: { id: data.sectionId, classId: data.classId, schoolId },
    select: { id: true },
  });
  if (!section)
    return NextResponse.json(
      { error: "Section not found for the selected class" },
      { status: 404 },
    );

  if (user.role === "TEACHER") {
    const { teacher, sections } = await getTeacherSections(user.id, schoolId);
    if (!teacher)
      return NextResponse.json(
        { error: "Teacher record not found" },
        { status: 403 },
      );
    if (!canTakeSection(sections, data.classId, data.sectionId)) {
      return NextResponse.json(
        { error: "You can only mark attendance for your own sections" },
        { status: 403 },
      );
    }
  }

  // Verify all students belong to this school, class, and section
  const studentIds = data.records.map((r) => r.studentId);
  const validStudents = await prisma.student.count({
    where: {
      id: { in: studentIds },
      schoolId,
      classId: data.classId,
      sectionId: data.sectionId,
    },
  });
  if (validStudents !== new Set(studentIds).size) {
    return NextResponse.json(
      {
        error:
          "One or more students do not belong to the selected class and section",
      },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    data.records.map((rec) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: rec.studentId, date } },
        update: { status: rec.status, markedById: user.id },
        create: {
          schoolId,
          studentId: rec.studentId,
          classId: data.classId,
          sectionId: data.sectionId,
          date,
          status: rec.status,
          markedById: user.id,
        },
      }),
    ),
  );
  return NextResponse.json({ success: true, saved: data.records.length });
}
