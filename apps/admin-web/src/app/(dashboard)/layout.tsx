import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { UserRole } from "@schoolos/types";

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar userRole={user.role as UserRole} schoolName="Delhi Public School" />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
