import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@schoolos/auth";
import { ForcedPasswordChange } from "@/components/auth/forced-password-change";

export const metadata: Metadata = { title: "Choose your password" };

/**
 * Where a login made with a temporary password lands (middleware sends it
 * here) until it has chosen its own.
 */
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");
  return <ForcedPasswordChange email={session.user.email} />;
}
