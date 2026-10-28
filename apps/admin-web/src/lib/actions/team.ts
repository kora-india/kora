"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@schoolos/db";
import {
  PermissionsSchema,
  UserRole,
  isStaffRole,
  permissionsProblem,
} from "@schoolos/types";
import { isError, requireSchoolAdmin } from "@/lib/auth-guard";
import { actionErrorMessage } from "@/lib/action-errors";
import { logger } from "@/lib/logger";
import { generateTempPassword } from "@/lib/temp-password";
import { emailLoginDetails } from "@/lib/login-details";

/**
 * Settings → Team & access: what each teacher and accountant may do, and
 * accountant logins. Only school admins get here, and no permission grants
 * it, so nobody can raise their own access.
 */

async function getAdminSession() {
  const guard = await requireSchoolAdmin();
  return isError(guard) ? null : guard;
}

/** An active teacher or accountant login at `schoolId`. */
async function findMember(userId: string, schoolId: string) {
  const member = await prisma.user.findFirst({
    where: { id: userId, schoolId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  return member && isStaffRole(member.role) ? member : null;
}

const NOT_A_MEMBER = "That login isn't a teacher or accountant at your school";

export async function updateMemberPermissions(userId: string, input: unknown) {
  const admin = await getAdminSession();
  if (!admin) return { error: "Unauthorized" };

  const parsed = PermissionsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Choose None, View or Manage for every module" };
  }
  const problem = permissionsProblem(parsed.data);
  if (problem) return { error: problem };

  const member = await findMember(userId, admin.schoolId);
  if (!member) return { error: NOT_A_MEMBER };

  try {
    await prisma.user.update({
      where: { id: member.id },
      data: { permissions: parsed.data },
    });
  } catch (e) {
    return { error: actionErrorMessage(e) };
  }

  logger.info("Member permissions changed", {
    schoolId: admin.schoolId,
    userId: member.id,
    by: admin.id,
  });
  revalidatePath("/settings/team");
  return { success: true, message: `${member.name}'s access saved` };
}

/** Back to what the member's role gets by default. */
export async function resetMemberPermissions(userId: string) {
  const admin = await getAdminSession();
  if (!admin) return { error: "Unauthorized" };

  const member = await findMember(userId, admin.schoolId);
  if (!member) return { error: NOT_A_MEMBER };

  try {
    await prisma.user.update({
      where: { id: member.id },
      data: { permissions: Prisma.DbNull },
    });
  } catch (e) {
    return { error: actionErrorMessage(e) };
  }

  logger.info("Member permissions reset to role defaults", {
    schoolId: admin.schoolId,
    userId: member.id,
    by: admin.id,
  });
  revalidatePath("/settings/team");
  const role = member.role === UserRole.TEACHER ? "teacher" : "accountant";
  return {
    success: true,
    message: `${member.name} is back to the ${role} defaults`,
  };
}

const AccountantSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  phone: z.string().trim().max(20).optional().nullable(),
});

/**
 * A login for an accountant, with the accountant defaults and a temporary
 * password, emailed to them and shown once. An accountant removed earlier with
 * the same email gets their login back instead.
 */
export async function createAccountant(data: unknown) {
  const admin = await getAdminSession();
  if (!admin) return { error: "Unauthorized" };

  const parsed = AccountantSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { name, email, phone } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, schoolId: true, role: true },
  });
  const rehire =
    existing &&
    !existing.isActive &&
    existing.schoolId === admin.schoolId &&
    existing.role === UserRole.ACCOUNTANT;
  if (existing && !rehire) {
    return { error: "A user with this email already exists" };
  }

  try {
    const tempPassword = generateTempPassword();
    const account = {
      name,
      phone: phone || null,
      password: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
    };
    const user = rehire
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            ...account,
            isActive: true,
            passwordChangedAt: new Date(),
            permissions: Prisma.DbNull,
          },
        })
      : await prisma.user.create({
          data: {
            ...account,
            email,
            role: UserRole.ACCOUNTANT,
            schoolId: admin.schoolId,
          },
        });

    logger.info(
      rehire ? "Accountant login restored" : "Accountant login created",
      { schoolId: admin.schoolId, userId: user.id, by: admin.id },
    );
    revalidatePath("/settings/team");

    const emailed = await emailLoginDetails({
      schoolId: admin.schoolId,
      to: email,
      name,
      role: "accountant",
      tempPassword,
      reactivated: Boolean(rehire),
    });
    return {
      success: true,
      id: user.id,
      tempPassword,
      emailed,
      reactivated: Boolean(rehire),
    };
  } catch (e: any) {
    if (e?.code === "P2002") {
      return { error: "A user with this email already exists" };
    }
    return { error: actionErrorMessage(e) };
  }
}

/** Turns an accountant's login off. Teachers leave from Teachers & Staff. */
export async function removeAccountant(userId: string) {
  const admin = await getAdminSession();
  if (!admin) return { error: "Unauthorized" };

  const member = await findMember(userId, admin.schoolId);
  if (!member) return { error: NOT_A_MEMBER };
  if (member.role !== UserRole.ACCOUNTANT) {
    return { error: "Remove teachers from Teachers & Staff" };
  }

  try {
    await prisma.user.update({
      where: { id: member.id },
      data: { isActive: false },
    });
  } catch (e) {
    return { error: actionErrorMessage(e) };
  }

  logger.info("Accountant login removed", {
    schoolId: admin.schoolId,
    userId: member.id,
    by: admin.id,
  });
  revalidatePath("/settings/team");
  return { success: true, message: `${member.name} can no longer sign in` };
}
