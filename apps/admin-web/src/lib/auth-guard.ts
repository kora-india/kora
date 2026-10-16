// Server-side guards for server actions and route handlers. Not a "use server"
// module: its exports are helpers, and must not become callable endpoints.

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";

export type GuardedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  schoolId: string;
};

export type SessionUserSnapshot = {
  id: string;
  email: string;
  name: string;
  role: string;
  schoolId: string | null;
};

type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "ACCOUNTANT";

/** Returns the session user or null. No role/school checks. */
export async function getSessionUser(): Promise<SessionUserSnapshot | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUserSnapshot;
}

/**
 * Requires an active session with one of the allowed roles, and verifies
 * that the user's school exists and is active (blocking suspended schools).
 */
export async function requireActiveSchoolSession(
  allowedRoles?: Role[],
): Promise<GuardedUser | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };
  if (!user.schoolId) return { error: "No school assigned to your account" };

  if (allowedRoles && !allowedRoles.includes(user.role as Role)) {
    return { error: "Forbidden: You do not have permission for this action" };
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { isActive: true },
  });
  if (!school) return { error: "School not found" };
  if (!school.isActive)
    return { error: "Your school account is suspended. Contact support." };

  return user as GuardedUser;
}

/** Requires an active session with one of the allowed roles and an active school. */
export async function requireRole(
  ...roles: Role[]
): Promise<GuardedUser | { error: string }> {
  return requireActiveSchoolSession(roles);
}

/**
 * Requires SCHOOL_ADMIN or SUPER_ADMIN and a schoolId.
 * Also verifies the school is still active before allowing writes.
 */
export async function requireSchoolAdmin(): Promise<
  GuardedUser | { error: string }
> {
  return requireActiveSchoolSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
}

/**
 * Returns the active user for an active school, or null if unauthorized or suspended.
 */
export async function getActiveSchoolUser(
  allowedRoles?: Role[],
): Promise<GuardedUser | null> {
  const res = await requireActiveSchoolSession(allowedRoles);
  if (isError(res)) return null;
  return res;
}

/** Validates that a record belongs to the session user's school. */
export async function assertSchoolOwnership(
  schoolIdFromRecord: string,
  sessionUser: GuardedUser,
): Promise<boolean> {
  if (sessionUser.role === "SUPER_ADMIN") return true;
  return sessionUser.schoolId === schoolIdFromRecord;
}

export function isError(result: unknown): result is { error: string } {
  return typeof result === "object" && result !== null && "error" in result;
}
