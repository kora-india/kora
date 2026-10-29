"use server";

import { prisma } from "@schoolos/db";
import { requirePermission } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity } from "@/lib/activity";

const NoticeSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  targetClassId: z.string().optional(),
  isPublished: z.boolean().default(true),
});

async function getAuthorizedSession() {
  const guard = await requirePermission("notices", "manage");
  if ("error" in guard) return null;
  return { ...guard, schoolId: guard.schoolId! };
}

export async function createNotice(data: unknown) {
  const user = await getAuthorizedSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = NoticeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const notice = await prisma.notice.create({
      data: {
        ...parsed.data,
        schoolId: user.schoolId,
        publishedById: user.id,
        targetClassId: parsed.data.targetClassId || null,
      },
    });
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/notices");
    revalidatePath("/dashboard");
    await logActivity(user, {
      action: "notice.create",
      module: "notices",
      summary: `Posted notice "${notice.title}"`,
      entityType: "Notice",
      entityId: notice.id,
    });
    return { success: true, id: notice.id };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

export async function updateNotice(id: string, data: unknown) {
  const user = await getAuthorizedSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = NoticeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const existing = await prisma.notice.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) return { error: "Notice not found" };

    if (user.role === "TEACHER" && existing.publishedById !== user.id) {
      return { error: "You can only edit your own notices" };
    }

    await prisma.notice.update({
      where: { id },
      data: {
        ...parsed.data,
        targetClassId: parsed.data.targetClassId || null,
      },
    });
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/notices");
    revalidatePath("/dashboard");
    await logActivity(user, {
      action: "notice.update",
      module: "notices",
      summary: `Edited notice "${parsed.data.title}"`,
      entityType: "Notice",
      entityId: existing.id,
    });
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

export async function deleteNotice(id: string) {
  const user = await getAuthorizedSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.notice.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) return { error: "Notice not found" };

    if (user.role === "TEACHER" && existing.publishedById !== user.id) {
      return { error: "You can only delete your own notices" };
    }

    await prisma.notice.delete({ where: { id } });
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/notices");
    revalidatePath("/dashboard");
    await logActivity(user, {
      action: "notice.delete",
      module: "notices",
      summary: `Deleted notice "${existing.title}"`,
      entityType: "Notice",
      entityId: existing.id,
    });
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

export async function toggleNoticePublish(id: string, isPublished: boolean) {
  const user = await getAuthorizedSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.notice.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) return { error: "Notice not found" };

    if (user.role === "TEACHER" && existing.publishedById !== user.id) {
      return {
        error: "You can only change the publish status of your own notices",
      };
    }

    await prisma.notice.update({
      where: { id },
      data: { isPublished },
    });
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/notices");
    revalidatePath("/dashboard");
    await logActivity(user, {
      action: isPublished ? "notice.publish" : "notice.unpublish",
      module: "notices",
      summary: `${isPublished ? "Published" : "Unpublished"} notice "${existing.title}"`,
      entityType: "Notice",
      entityId: existing.id,
    });
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
