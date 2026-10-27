import { NextRequest, NextResponse } from "next/server";
import { isError, requirePermission } from "@/lib/auth-guard";
import { prisma } from "@schoolos/db";
import { compareRollNumbers } from "@schoolos/types";

export async function GET(req: NextRequest) {
  const access = await requirePermission("students");
  if (isError(access)) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "Unauthorized" ? 401 : 403 },
    );
  }
  const user = access;

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

  students.sort((a, b) => compareRollNumbers(a.rollNumber, b.rollNumber));

  return NextResponse.json({ students });
}
