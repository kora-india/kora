import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { UserRole } from "@schoolos/types";

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumb?: string;
}

export async function DashboardLayout({ children, breadcrumb }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) redirect("/login");

  const user = session.user as any;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar userRole={user.role as UserRole} schoolName={user.schoolName} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} breadcrumb={breadcrumb} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
