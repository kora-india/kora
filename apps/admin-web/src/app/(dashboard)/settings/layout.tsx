import { auth } from "@schoolos/auth";
import { UserRole } from "@schoolos/types";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const userRole = session?.user?.role ?? UserRole.SCHOOL_ADMIN;
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;

  return (
    <div className="p-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isSuperAdmin ? "Platform Settings" : "Settings"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isSuperAdmin
            ? "Manage SaaS multi-tenant infrastructure, plan enforcements, and security"
            : "Manage your school's profile, fees, and account preferences"}
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <SettingsNav userRole={userRole} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
