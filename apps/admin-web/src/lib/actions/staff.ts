"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCache, invalidateCache } from "@/lib/redis";

const StaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(7, "Phone number is required"),
  occupation: z.string().min(1, "Occupation is required"),
  qualification: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  salary: z.coerce.number().min(0).optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role)) return null;
  return session.user;
}

export async function createStaff(data: unknown) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  const parsed = StaffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { name, phone, occupation, qualification, email, salary, joiningDate, address } = parsed.data;

  try {
    const staff = await prisma.staff.create({
      data: {
        schoolId: user.schoolId,
        name: name.trim(),
        phone: phone.trim(),
        occupation: occupation.trim(),
        qualification: qualification?.trim() || null,
        email: email?.trim() || null,
        salary: salary ? salary : null,
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        address: address?.trim() || null,
      },
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:staff:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
    ]);

    revalidatePath("/teachers");
    revalidatePath("/dashboard");

    return { success: true, id: staff.id };
  } catch (e: any) {
    return { error: e.message || "Failed to create staff member" };
  }
}

export async function updateStaff(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  const parsed = StaffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { name, phone, occupation, qualification, email, salary, joiningDate, address } = parsed.data;

  try {
    const staff = await prisma.staff.update({
      where: { id, schoolId: user.schoolId },
      data: {
        name: name.trim(),
        phone: phone.trim(),
        occupation: occupation.trim(),
        qualification: qualification?.trim() || null,
        email: email?.trim() || null,
        salary: salary ? salary : null,
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        address: address?.trim() || null,
      },
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:staff:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
    ]);

    revalidatePath("/teachers");
    revalidatePath("/dashboard");

    return { success: true, id: staff.id };
  } catch (e: any) {
    return { error: e.message || "Failed to update staff member" };
  }
}

export async function deleteStaff(id: string) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  try {
    await prisma.staff.update({
      where: { id, schoolId: user.schoolId },
      data: { isActive: false },
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:staff:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
    ]);

    revalidatePath("/teachers");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Failed to remove staff member" };
  }
}

export async function getStaffList(schoolId: string) {
  return getCache(
    `cache:${schoolId}:staff:list`,
    () =>
      prisma.staff.findMany({
        where: { schoolId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    60
  );
}
