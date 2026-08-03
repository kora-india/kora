"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const NoticeSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  targetClassId: z.string().optional(),
  isPublished: z.boolean().default(true),
});

async function getAuthorizedSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
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
    revalidatePath("/notices");
    return { success: true, id: notice.id };
  } catch (e: any) {
    return { error: e.message };
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
      data: { ...parsed.data, targetClassId: parsed.data.targetClassId || null },
    });
    revalidatePath("/notices");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
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
    revalidatePath("/notices");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function toggleNoticePublish(id: string, isPublished: boolean) {
  const user = await getAuthorizedSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.notice.update({
      where: { id, schoolId: user.schoolId },
      data: { isPublished },
    });
    revalidatePath("/notices");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
