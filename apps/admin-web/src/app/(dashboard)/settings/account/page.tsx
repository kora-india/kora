import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { ChangePasswordContent } from "@/components/settings/change-password-content";

export const metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <AppearanceCard />
      <ChangePasswordContent />
    </div>
  );
}
