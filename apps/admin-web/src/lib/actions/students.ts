"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkStudentLimit, planLimitMessage } from "@/lib/plan-limits";

const StudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  rollNumber: z.string().min(1, "Roll number is required"),
  admissionNumber: z.string().min(1, "Admission number is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  parentName: z.string().min(2, "Parent name is required"),
  parentPhone: z.string().min(6, "Parent phone is required"),
  parentEmail: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function createStudent(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = StudentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const limit = await checkStudentLimit(user.schoolId);
  if (!limit.allowed) {
    return { error: planLimitMessage("students", limit.current, limit.max, limit.plan) };
  }

  const { dateOfBirth, parentEmail, ...rest } = parsed.data;

  try {
    const student = await prisma.student.create({
      data: {
        ...rest,
        schoolId: user.schoolId,
        parentEmail: parentEmail || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });
    revalidatePath("/students");
    return { success: true, id: student.id };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "A student with this admission or roll number already exists" };
    return { error: e.message };
  }
}

export async function updateStudent(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = StudentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { dateOfBirth, parentEmail, ...rest } = parsed.data;

  try {
    await prisma.student.update({
      where: { id, schoolId: user.schoolId },
      data: {
        ...rest,
        parentEmail: parentEmail || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });
    revalidatePath("/students");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "Roll number already exists in this class" };
    return { error: e.message };
  }
}

export async function deleteStudent(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.student.update({
      where: { id, schoolId: user.schoolId },
      data: { isActive: false },
    });
    revalidatePath("/students");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
