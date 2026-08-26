import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@schoolos/types";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === UserRole.SUPER_ADMIN) {
    redirect("/settings/platform");
  }

  redirect("/settings/school-profile");
}

