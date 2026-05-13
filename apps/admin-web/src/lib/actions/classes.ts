"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ClassSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  grade: z.coerce.number().min(1).max(13),
});

const SectionSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Section name is required"),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return user;
}

export async function createClass(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ClassSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const cls = await prisma.class.create({
      data: { ...parsed.data, schoolId: user.schoolId },
    });
    revalidatePath("/classes");
    return { success: true, id: cls.id };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "A class with this name already exists" };
    return { error: e.message };
  }
}

export async function updateClass(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ClassSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.class.update({
      where: { id, schoolId: user.schoolId },
      data: parsed.data,
    });
    revalidatePath("/classes");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "A class with this name already exists" };
    return { error: e.message };
  }
}

export async function deleteClass(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.class.delete({ where: { id, schoolId: user.schoolId } });
    revalidatePath("/classes");
    return { success: true };
  } catch (e: any) {
    return { error: "Cannot delete class with existing students or sections" };
  }
}

export async function createSection(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = SectionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const cls = await prisma.class.findFirst({
      where: { id: parsed.data.classId, schoolId: user.schoolId },
    });
    if (!cls) return { error: "Class not found" };

    const section = await prisma.section.create({
      data: { ...parsed.data, schoolId: user.schoolId },
    });
    revalidatePath("/classes");
    return { success: true, id: section.id };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "Section already exists in this class" };
    return { error: e.message };
  }
}

export async function deleteSection(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.section.delete({ where: { id, schoolId: user.schoolId } });
    revalidatePath("/classes");
    return { success: true };
  } catch (e: any) {
    return { error: "Cannot delete section with existing students" };
  }
}
