"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import type { Prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { checkTeacherLimit, planLimitMessage } from "@/lib/plan-limits";

const TeacherSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  qualification: z.string().optional(),
  assignedClassId: z.string().optional(),
  assignedSectionId: z.string().optional(),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createTeacher(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = TeacherSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const limit = await checkTeacherLimit(user.schoolId);
  if (!limit.allowed) {
    return { error: planLimitMessage("teachers", limit.current, limit.max, limit.plan) };
  }

  const { assignedClassId, assignedSectionId, ...rest } = parsed.data;

  try {
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          email: rest.email,
          name: rest.name,
          password: hashedPassword,
          role: "TEACHER",
          phone: rest.phone,
          schoolId: user.schoolId,
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          ...rest,
          schoolId: user.schoolId,
          userId: newUser.id,
          assignedClassId: assignedClassId || null,
          assignedSectionId: assignedSectionId || null,
        },
      });

      return teacher;
    });

    revalidatePath("/teachers");
    return { success: true, id: result.id, tempPassword };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "A user with this email already exists" };
    return { error: e.message };
  }
}

export async function updateTeacher(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = TeacherSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { assignedClassId, assignedSectionId, ...rest } = parsed.data;

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const teacher = await tx.teacher.findFirst({
        where: { id, schoolId: user.schoolId },
      });
      if (!teacher) throw new Error("Teacher not found");

      await tx.user.update({
        where: { id: teacher.userId },
        data: { name: rest.name, email: rest.email, phone: rest.phone },
      });

      await tx.teacher.update({
        where: { id },
        data: {
          ...rest,
          assignedClassId: assignedClassId || null,
          assignedSectionId: assignedSectionId || null,
        },
      });
    });

    revalidatePath("/teachers");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteTeacher(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!teacher) return { error: "Teacher not found" };

    await prisma.$transaction([
      prisma.teacher.update({ where: { id }, data: { isActive: false } }),
      prisma.user.update({ where: { id: teacher.userId }, data: { isActive: false } }),
    ]);

    revalidatePath("/teachers");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
