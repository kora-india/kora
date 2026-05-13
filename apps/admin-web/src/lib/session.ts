import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
};

export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

export async function requireSchoolSession(): Promise<SessionUser & { schoolId: string }> {
  const user = await requireSession();
  if (!user.schoolId) throw new Error("No school assigned to this account");
  return user as SessionUser & { schoolId: string };
}

export function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN";
}

export function canEdit(role: string) {
  return isAdmin(role) || role === "ACCOUNTANT";
}
