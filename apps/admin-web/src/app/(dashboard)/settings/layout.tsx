import { Settings } from "lucide-react";
import { auth } from "@schoolos/auth";
import { UserRole } from "@schoolos/types";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsHeaderArt } from "@/components/settings/settings-header-art";

const SUBTITLES: Partial<Record<UserRole, string>> = {
  [UserRole.SUPER_ADMIN]:
    "Manage SaaS multi-tenant infrastructure, plan enforcements, and security",
  [UserRole.SCHOOL_ADMIN]:
    "Manage your school's profile, admission format, team access and more.",
};

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const userRole = session?.user?.role ?? UserRole.SCHOOL_ADMIN;
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;

  return (
    <div className="p-4 sm:p-6 w-full">
      <header className="relative mb-6">
        <SettingsHeaderArt className="pointer-events-none absolute -top-2 right-0 hidden h-28 w-auto text-violet-300 dark:text-violet-800/80 md:block" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100/80 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
            <Settings className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0 md:pr-72">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {isSuperAdmin ? "Platform Settings" : "Settings"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {SUBTITLES[userRole] ??
                "Manage your school's profile and your account."}
            </p>
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-6">
        <SettingsNav userRole={userRole} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
