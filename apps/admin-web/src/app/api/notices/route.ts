import { NextRequest, NextResponse } from "next/server";
import { isError, requirePermission } from "@/lib/auth-guard";
import { prisma } from "@schoolos/db";
import { z } from "zod";
import { invalidateCache } from "@/lib/redis";
import { logActivity } from "@/lib/activity";
import {
  isNoticeTargetAllowed,
  NOTICE_CLASS_NOT_FOUND,
} from "@/lib/notice-target";

const NoticeSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(10),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  targetClassId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const access = await requirePermission("notices", "manage");
  if (isError(access)) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "Unauthorized" ? 401 : 403 },
    );
  }
  const user = access;

  const parsed = NoticeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid notice" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (!(await isNoticeTargetAllowed(user.schoolId, data.targetClassId))) {
    return NextResponse.json(
      { error: NOTICE_CLASS_NOT_FOUND },
      { status: 400 },
    );
  }

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
  await logActivity(user, {
    action: "notice.create",
    module: "notices",
    summary: `Posted notice "${notice.title}"`,
    entityType: "Notice",
    entityId: notice.id,
  });

  return NextResponse.json(notice);
}
