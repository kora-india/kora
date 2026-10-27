"use server";

import { prisma } from "@schoolos/db";
import { isError, requirePermission } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionErrorMessage } from "@/lib/action-errors";

const AssignmentSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

async function getTeacherSession() {
  const access = await requirePermission("assignments", "manage");
  return isError(access) ? null : access;
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
    const classObj = await prisma.class.findFirst({
      where: { id: parsed.data.classId, schoolId: user.schoolId },
      select: { id: true, classTeacherId: true },
    });
    if (!classObj) return { error: "Class not found in your school" };

    const sectionObj = await prisma.section.findFirst({
      where: {
        id: parsed.data.sectionId,
        classId: parsed.data.classId,
        schoolId: user.schoolId,
      },
    });
    if (!sectionObj) return { error: "Section not found for this class" };

    let teacherId: string | null = null;

    if (user.role === "TEACHER") {
      teacherId = await resolveTeacherId(user.id, user.schoolId);
      if (!teacherId) return { error: "Teacher record not found" };
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          assignedSections: true,
          classTeacherOf: { select: { id: true } },
        },
      });
      const isDirectMatch = teacher?.assignedClassId === parsed.data.classId;
      const isSectionMatch = teacher?.assignedSections.some(
        (as) =>
          as.classId === parsed.data.classId &&
          (!parsed.data.sectionId || as.sectionId === parsed.data.sectionId),
      );
      const isClassTeacher = teacher?.classTeacherOf.some(
        (ct) => ct.id === parsed.data.classId,
      );

      if (!isDirectMatch && !isSectionMatch && !isClassTeacher) {
        return {
          error: "You can only create assignments for your assigned classes",
        };
      }
    } else {
      if (classObj.classTeacherId) {
        teacherId = classObj.classTeacherId;
      } else {
        const assignedTeacher = await prisma.teacher.findFirst({
          where: {
            schoolId: user.schoolId,
            OR: [
              {
                assignedSections: {
                  some: {
                    classId: parsed.data.classId,
                    sectionId: parsed.data.sectionId,
                  },
                },
              },
              { assignedClassId: parsed.data.classId },
            ],
          },
        });
        if (!assignedTeacher) {
          return {
            error:
              "No teacher is assigned to this class and section yet. Assign one first.",
          };
        }
        teacherId = assignedTeacher.id;
      }
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
    return { error: actionErrorMessage(e) };
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

    const classObj = await prisma.class.findFirst({
      where: { id: parsed.data.classId, schoolId: user.schoolId },
    });
    if (!classObj) return { error: "Class not found in your school" };

    const sectionObj = await prisma.section.findFirst({
      where: {
        id: parsed.data.sectionId,
        classId: parsed.data.classId,
        schoolId: user.schoolId,
      },
    });
    if (!sectionObj) return { error: "Section not found for this class" };

    await prisma.assignment.update({
      where: { id: existing.id },
      data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate) },
    });
    revalidatePath("/assignments");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
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

    await prisma.assignment.delete({ where: { id: existing.id } });
    revalidatePath("/assignments");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
