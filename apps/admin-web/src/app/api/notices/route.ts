import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { z } from "zod";
import { invalidateCache } from "@/lib/redis";

const NoticeSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(10),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  targetClassId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;
  if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data = NoticeSchema.parse(body);

  const notice = await prisma.notice.create({
    data: {
      ...data,
      priority: data.priority as any,
      schoolId: user.schoolId,
      publishedById: user.id,
      isPublished: true,
    },
  });

  await invalidateCache(`cache:${user.schoolId}:dashboard`);

  return NextResponse.json(notice);
}
