import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { prisma } from "@schoolos/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

export default async function DashboardRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;

  const schoolId = user.schoolId;

  // Redirect to setup if SCHOOL_ADMIN doesn't have a school
  if (user.role === "SCHOOL_ADMIN" && !schoolId) {
    redirect("/setup");
  }

  let schoolName = "";

  if (schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { isActive: true, name: true },
    });
    
    if (school) {
      schoolName = school.name;
      if (user.role !== "SUPER_ADMIN" && !school.isActive) {
        redirect("/suspended");
      }
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar userRole={user.role} schoolName={schoolName} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
