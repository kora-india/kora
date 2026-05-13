"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";

export type GuardedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  schoolId: string | null;
};

type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "ACCOUNTANT";

/** Returns the session user or null. No role/school checks. */
export async function getSessionUser(): Promise<GuardedUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as GuardedUser;
}

/** Requires an active session with one of the allowed roles. */
export async function requireRole(...roles: Role[]): Promise<GuardedUser | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };
  if (!roles.includes(user.role as Role)) return { error: "Forbidden" };
  return user;
}

/**
 * Requires SCHOOL_ADMIN or SUPER_ADMIN and a schoolId.
 * Also verifies the school is still active before allowing writes.
 */
export async function requireSchoolAdmin(): Promise<GuardedUser | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return { error: "Forbidden" };
  if (!user.schoolId) return { error: "No school assigned to your account" };

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { isActive: true },
  });
  if (!school) return { error: "School not found" };
  if (!school.isActive) return { error: "Your school account is suspended. Contact support." };

  return user;
}

/** Validates that a record belongs to the session user's school. */
export async function assertSchoolOwnership(
  schoolIdFromRecord: string,
  sessionUser: GuardedUser
): Promise<boolean> {
  if (sessionUser.role === "SUPER_ADMIN") return true;
  return sessionUser.schoolId === schoolIdFromRecord;
}

export function isError(result: unknown): result is { error: string } {
  return typeof result === "object" && result !== null && "error" in result;
}
