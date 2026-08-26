import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@schoolos/types";
import { PlatformSettingsContent } from "@/components/settings/platform-settings-content";

export const metadata = { title: "Platform Settings" };

export default async function PlatformSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (user.role !== UserRole.SUPER_ADMIN) redirect("/settings/school-profile");

  return <PlatformSettingsContent />;
}
