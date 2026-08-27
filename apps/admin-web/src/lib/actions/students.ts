"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkStudentLimit, planLimitMessage } from "@/lib/plan-limits";
import { getCache, invalidateCache } from "@/lib/redis";

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
  bloodGroup: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

async function getStaffSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function searchStudents(query: string = "", limit: number = 25) {
  const user = await getStaffSession();
  if (!user) return { error: "Unauthorized" };

  const trimmed = query.trim();

  const whereClause: any = {
    schoolId: user.schoolId,
    isActive: true,
  };

  if (trimmed) {
    whereClause.OR = [
      { name: { contains: trimmed, mode: "insensitive" } },
      { rollNumber: { contains: trimmed, mode: "insensitive" } },
      { admissionNumber: { contains: trimmed, mode: "insensitive" } },
      { parentPhone: { contains: trimmed, mode: "insensitive" } },
      { parentName: { contains: trimmed, mode: "insensitive" } },
      { class: { name: { contains: trimmed, mode: "insensitive" } } },
      { section: { name: { contains: trimmed, mode: "insensitive" } } },
    ];
  }

  try {
    const students = await prisma.student.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        rollNumber: true,
        admissionNumber: true,
        parentPhone: true,
        parentName: true,
        address: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [
        { class: { name: "asc" } },
        { rollNumber: "asc" },
        { name: "asc" },
      ],
      take: Math.min(Math.max(1, limit), 50),
    });

    return { success: true, students };
  } catch (err: any) {
    return { error: err.message || "Failed to search students" };
  }
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
    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:students:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
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
    const student = await prisma.student.update({
      where: { id, schoolId: user.schoolId },
      data: {
        ...rest,
        parentEmail: parentEmail || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });
    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:students:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return { success: true, id: student.id };
  } catch (e: any) {
    if (e.code === "P2002") return { error: "A student with this admission or roll number already exists" };
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
    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:students:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getStudentDetails(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const student = await getCache(`cache:${user.schoolId}:students:details:${id}`, () => 
      prisma.student.findUnique({
        where: { id, schoolId: user.schoolId },
        include: {
          class: true,
          section: true,
          fees: {
            orderBy: { dueDate: "desc" },
          },
          feeCharges: {
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: {
                  component: true
                }
              },
            },
          },
          paymentTxs: {
            orderBy: { date: "desc" },
          },
          advanceLedgers: {
            orderBy: { createdAt: "desc" },
          },
          transports: {
            where: { status: "ACTIVE" },
            include: {
              route: true,
              stop: true,
              vehicle: true,
            },
          },
        },
      })
    );
    return { success: true, student };
  } catch (e: any) {
    return { error: e.message };
  }
}
