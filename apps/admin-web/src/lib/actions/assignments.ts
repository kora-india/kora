"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AssignmentSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

async function getTeacherSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

async function resolveTeacherId(userId: string, schoolId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId },
  });
  return teacher?.id ?? null;
}

export async function createAssignment(data: unknown) {
  const user = await getTeacherSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = AssignmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    let teacherId: string | null = null;

    if (user.role === "TEACHER") {
      teacherId = await resolveTeacherId(user.id, user.schoolId);
      if (!teacherId) return { error: "Teacher record not found" };
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (teacher?.assignedClassId !== parsed.data.classId) {
        return { error: "You can only create assignments for your assigned class" };
      }
    } else {
      const classTeacher = await prisma.teacher.findFirst({
        where: {
          schoolId: user.schoolId,
          assignedClassId: parsed.data.classId,
          assignedSectionId: parsed.data.sectionId,
        },
      });
      if (!classTeacher) {
        return { error: "No teacher is assigned to this class and section yet. Assign one first." };
      }
      teacherId = classTeacher.id;
    }

    const assignment = await prisma.assignment.create({
      data: {
        ...parsed.data,
        schoolId: user.schoolId,
        teacherId,
        dueDate: new Date(parsed.data.dueDate),
      },
    });
    revalidatePath("/assignments");
    return { success: true, id: assignment.id };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function updateAssignment(id: string, data: unknown) {
  const user = await getTeacherSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = AssignmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const existing = await prisma.assignment.findFirst({
      where: { id, schoolId: user.schoolId },
      include: { teacher: { select: { userId: true } } },
    });
    if (!existing) return { error: "Assignment not found" };

    if (user.role === "TEACHER" && existing.teacher.userId !== user.id) {
      return { error: "You can only edit your own assignments" };
    }

    await prisma.assignment.update({
      where: { id },
      data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate) },
    });
    revalidatePath("/assignments");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteAssignment(id: string) {
  const user = await getTeacherSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.assignment.findFirst({
      where: { id, schoolId: user.schoolId },
      include: { teacher: { select: { userId: true } } },
    });
    if (!existing) return { error: "Assignment not found" };

    if (user.role === "TEACHER" && existing.teacher.userId !== user.id) {
      return { error: "You can only delete your own assignments" };
    }

    await prisma.assignment.delete({ where: { id } });
    revalidatePath("/assignments");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
