import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { z } from "zod";

const MarkAttendanceSchema = z.object({
  classId: z.string(),
  sectionId: z.string(),
  date: z.string(),
  records: z.array(z.object({
    studentId: z.string(),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    remarks: z.string().optional(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user;
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
    const schoolId = user.schoolId;
    const body = await req.json();
    const data = MarkAttendanceSchema.parse(body);

    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);

    await prisma.$transaction(
      data.records.map((rec) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: rec.studentId, date } },
          update: { status: rec.status as any, markedById: user.id, remarks: rec.remarks },
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
        })
      )
    );

    return NextResponse.json({ success: true, count: data.records.length });
  } catch (err) {
    console.error("Attendance POST error:", err);
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}

const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user;
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get("limit")) || MAX_PAGE_SIZE));

    const where: any = { schoolId: user.schoolId };
    if (classId) where.classId = classId;
    if (date) { const d = new Date(date); d.setHours(0,0,0,0); where.date = d; }

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

    return NextResponse.json({ records, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
