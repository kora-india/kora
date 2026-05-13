import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const classId = searchParams.get("classId");
  const sectionId = searchParams.get("sectionId");

  const students = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
    },
    select: {
      id: true,
      name: true,
      rollNumber: true,
      admissionNumber: true,
      classId: true,
      sectionId: true,
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
    orderBy: { rollNumber: "asc" },
    take: 100,
  });

  return NextResponse.json({ students });
}
