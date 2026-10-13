import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { z } from "zod";

const Schema = z.object({
  classId: z.string(),
  sectionId: z.string(),
  date: z.string(),
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;
  if (!user.schoolId)
    return NextResponse.json({ error: "No school" }, { status: 403 });
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const schoolId = user.schoolId;
  const data = Schema.parse(await req.json());

  // Verify class and section belong to school
  const cls = await prisma.class.findFirst({
    where: { id: data.classId, schoolId },
  });
  if (!cls)
    return NextResponse.json(
      { error: "Class not found in your school" },
      { status: 404 },
    );

  const section = await prisma.section.findFirst({
    where: { id: data.sectionId, classId: data.classId, schoolId },
  });
  if (!section)
    return NextResponse.json(
      { error: "Section not found for the selected class" },
      { status: 404 },
    );

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId },
      include: {
        assignedSections: true,
        classTeacherOf: { select: { id: true } },
      },
    });
    if (!teacher)
      return NextResponse.json(
        { error: "Teacher record not found" },
        { status: 403 },
      );
    const isDirectMatch =
      teacher.assignedClassId === data.classId &&
      (!teacher.assignedSectionId ||
        teacher.assignedSectionId === data.sectionId);
    const isSectionMatch = teacher.assignedSections?.some(
      (as) => as.classId === data.classId && as.sectionId === data.sectionId,
    );
    const isClassTeacher = teacher.classTeacherOf?.some(
      (ct) => ct.id === data.classId,
    );

    if (!isDirectMatch && !isSectionMatch && !isClassTeacher) {
      return NextResponse.json(
        { error: "You can only mark attendance for your assigned class" },
        { status: 403 },
      );
    }
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
        update: { status: rec.status as any, markedById: user.id },
        create: {
          schoolId,
          studentId: rec.studentId,
          classId: data.classId,
          sectionId: data.sectionId,
          date,
          status: rec.status as any,
          markedById: user.id,
        },
      }),
    ),
  );
  return NextResponse.json({ success: true });
}
