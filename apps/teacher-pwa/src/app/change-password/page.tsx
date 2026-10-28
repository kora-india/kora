import { redirect } from "next/navigation";
import { auth } from "@schoolos/auth";
import { PasswordChangeForm } from "@/components/auth/password-change-form";

export const metadata = { title: "Choose your password" };

/** Middleware sends a teacher here until they replace their temporary password. */
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/");
  return <PasswordChangeForm email={session.user.email} />;
}
