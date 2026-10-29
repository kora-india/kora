"use server";

import { prisma } from "@schoolos/db";
import { requirePermission } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCache, invalidateCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity } from "@/lib/activity";

const StaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(7, "Phone number is required"),
  occupation: z.string().min(1, "Occupation is required"),
  qualification: z.string().optional().nullable(),
  email: z
    .string()
    .email("Invalid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  salary: z.coerce.number().min(0).optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

async function getAdminSession() {
  const guard = await requirePermission("staff", "manage");
  if ("error" in guard) return null;
  return { ...guard, schoolId: guard.schoolId! };
}

export async function createStaff(data: unknown) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  const parsed = StaffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const {
    name,
    phone,
    occupation,
    qualification,
    email,
    salary,
    joiningDate,
    address,
  } = parsed.data;

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
    await logActivity(user, {
      action: "staff.create",
      module: "staff",
      summary: `Added staff member ${staff.name} (${staff.occupation})`,
      entityType: "Staff",
      entityId: staff.id,
    });

    return { success: true, id: staff.id };
  } catch (e: any) {
    return { error: actionErrorMessage(e, "Failed to create staff member") };
  }
}

export async function updateStaff(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  const parsed = StaffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const {
    name,
    phone,
    occupation,
    qualification,
    email,
    salary,
    joiningDate,
    address,
  } = parsed.data;

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
    await logActivity(user, {
      action: "staff.update",
      module: "staff",
      summary: `Edited staff member ${staff.name}`,
      entityType: "Staff",
      entityId: staff.id,
    });

    return { success: true, id: staff.id };
  } catch (e: any) {
    return { error: actionErrorMessage(e, "Failed to update staff member") };
  }
}

export async function deleteStaff(id: string) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  try {
    const staff = await prisma.staff.update({
      where: { id, schoolId: user.schoolId },
      data: { isActive: false },
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:staff:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
    ]);

    revalidatePath("/teachers");
    revalidatePath("/dashboard");
    await logActivity(user, {
      action: "staff.remove",
      module: "staff",
      summary: `Removed staff member ${staff.name}`,
      entityType: "Staff",
      entityId: staff.id,
    });

    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e, "Failed to remove staff member") };
  }
}

export async function getStaffList() {
  const guard = await requirePermission("staff");
  if ("error" in guard) return [];
  const schoolId = guard.schoolId!;

  return getCache(
    `cache:${schoolId}:staff:list`,
    () =>
      prisma.staff.findMany({
        where: { schoolId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    60,
  );
}
