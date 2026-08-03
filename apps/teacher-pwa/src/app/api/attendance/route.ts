import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { z } from "zod";

const Schema = z.object({
  classId: z.string(),
  sectionId: z.string(),
  date: z.string(),
  records: z.array(z.object({ studentId: z.string(), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]) })),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;
  if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  const schoolId = user.schoolId;
  const data = Schema.parse(await req.json());
  const date = new Date(data.date);
  date.setHours(0,0,0,0);

  await prisma.$transaction(
    data.records.map((rec) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: rec.studentId, date } },
        update: { status: rec.status as any, markedById: user.id },
        create: { schoolId, studentId: rec.studentId, classId: data.classId, sectionId: data.sectionId, date, status: rec.status as any, markedById: user.id },
      })
    )
  );
  return NextResponse.json({ success: true });
}
