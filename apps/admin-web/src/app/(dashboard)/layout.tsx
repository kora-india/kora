import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { prisma } from "@schoolos/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";
import { UserRole } from "@schoolos/types";

export default async function DashboardRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  // Check school suspension — SUPER_ADMIN is always allowed
  if (user.schoolId && user.role !== "SUPER_ADMIN") {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { isActive: true, name: true },
    });
    if (school && !school.isActive) {
      redirect("/suspended");
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar userRole={user.role as UserRole} schoolName="Delhi Public School" />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
