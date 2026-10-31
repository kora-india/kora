"use server";

import { revalidatePath } from "next/cache";
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
import { logActivity } from "@/lib/activity";

/**
 * Settings → Team & access: what each teacher and accountant may do. People
 * are added and removed in Teachers & Staff, which also handles their logins.
 * Only school admins get here, and no permission grants it, so nobody can
 * raise their own access.
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
  await logActivity(admin, {
    action: "team.permissions",
    module: "settings",
    summary: `Changed what ${member.name} can access`,
    entityType: "User",
    entityId: member.id,
    details: { permissions: parsed.data },
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
  await logActivity(admin, {
    action: "team.permissions_reset",
    module: "settings",
    summary: `Reset ${member.name}'s access to the ${role} defaults`,
    entityType: "User",
    entityId: member.id,
  });
  return {
    success: true,
    message: `${member.name} is back to the ${role} defaults`,
  };
}
