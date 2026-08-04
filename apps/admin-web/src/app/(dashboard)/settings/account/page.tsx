import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { ChangePasswordContent } from "@/components/settings/change-password-content";

export const metadata = { title: "Change Password" };

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <ChangePasswordContent />;
}
