"use server";

import { prisma } from "@schoolos/db";
import { requirePermission } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCache, invalidateCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity } from "@/lib/activity";
import { addAccountantLogin } from "@/lib/accountant-login";
import { isAdmin } from "@/lib/session";
import { isAccountant } from "@/lib/staff-occupation";

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
  /** An accountant who should be able to sign in. */
  createLogin: z.boolean().optional(),
});

const staffFields = (input: z.infer<typeof StaffSchema>) => ({
  name: input.name.trim(),
  phone: input.phone.trim(),
  occupation: input.occupation.trim(),
  qualification: input.qualification?.trim() || null,
  email: input.email?.trim() || null,
  salary: input.salary ? input.salary : null,
  joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
  address: input.address?.trim() || null,
});

/** Logins open the school to someone, so only an admin gives them out. */
const loginProblem = (role: string, email: string | null) => {
  if (!isAdmin(role)) return "Only a school admin can give someone a login";
  return email ? null : "Add their email so they can sign in";
};

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

  const fields = staffFields(parsed.data);
  const wantsLogin = parsed.data.createLogin && isAccountant(fields.occupation);
  const problem = wantsLogin && loginProblem(user.role, fields.email);
  if (problem) return { error: problem };

  try {
    const record = { ...fields, schoolId: user.schoolId };
    let staff;
    let login;
    if (wantsLogin) {
      const email = fields.email!.toLowerCase();
      const added = await addAccountantLogin(
        user,
        { name: fields.name, email, phone: fields.phone },
        (tx, userId) => tx.staff.create({ data: { ...record, email, userId } }),
      );
      if ("error" in added) return added;
      staff = added.linked;
      login = added.login;
    } else {
      staff = await prisma.staff.create({ data: record });
    }

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

    return { success: true, id: staff.id, login };
  } catch (e: any) {
    return { error: actionErrorMessage(e, "Failed to create staff member") };
  }
}

export async function updateStaff(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  const parsed = StaffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const current = await prisma.staff.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { userId: true, email: true, occupation: true },
  });
  if (!current) return { error: "Staff member not found" };

  const fields = staffFields(parsed.data);
  // A login's email is how they sign in, and it makes them an accountant.
  if (current.userId) {
    fields.email = current.email;
    fields.occupation = current.occupation;
  }
  const wantsLogin =
    parsed.data.createLogin &&
    !current.userId &&
    isAccountant(fields.occupation);
  const problem = wantsLogin && loginProblem(user.role, fields.email);
  if (problem) return { error: problem };

  try {
    let staff;
    let login;
    if (wantsLogin) {
      const email = fields.email!.toLowerCase();
      const added = await addAccountantLogin(
        user,
        { name: fields.name, email, phone: fields.phone },
        (tx, userId) =>
          tx.staff.update({
            where: { id },
            data: { ...fields, email, userId },
          }),
      );
      if ("error" in added) return added;
      staff = added.linked;
      login = added.login;
    } else {
      [staff] = await prisma.$transaction([
        prisma.staff.update({
          where: { id, schoolId: user.schoolId },
          data: fields,
        }),
        // Their name and phone on the login follow their staff record.
        ...(current.userId
          ? [
              prisma.user.update({
                where: { id: current.userId },
                data: { name: fields.name, phone: fields.phone },
              }),
            ]
          : []),
      ]);
    }

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

    return { success: true, id: staff.id, login };
  } catch (e: any) {
    return { error: actionErrorMessage(e, "Failed to update staff member") };
  }
}

export async function deleteStaff(id: string) {
  const user = await getAdminSession();
  if (!user?.schoolId) return { error: "Unauthorized" };

  const current = await prisma.staff.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { userId: true },
  });
  const userId = current?.userId;
  if (userId && !isAdmin(user.role)) {
    return { error: "Only a school admin can remove someone who signs in" };
  }

  try {
    const [staff] = await prisma.$transaction([
      prisma.staff.update({
        where: { id, schoolId: user.schoolId },
        data: { isActive: false },
      }),
      // Leaving the school ends their login too.
      ...(userId
        ? [
            prisma.user.update({
              where: { id: userId },
              data: { isActive: false },
            }),
          ]
        : []),
    ]);

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:staff:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
    ]);

    revalidatePath("/teachers");
    revalidatePath("/dashboard");
    revalidatePath("/settings/team");
    await logActivity(user, {
      action: "staff.remove",
      module: "staff",
      summary: `Removed staff member ${staff.name}${userId ? " and their login" : ""}`,
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
