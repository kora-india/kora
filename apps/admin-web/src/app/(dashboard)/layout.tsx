import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { prisma } from "@schoolos/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

export default async function DashboardRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;

  const schoolId = user.schoolId;

  // Redirect to setup if SCHOOL_ADMIN doesn't have a school
  if (user.role === "SCHOOL_ADMIN" && !schoolId) {
    redirect("/setup");
  }

  let schoolName = "";
  let schoolPlan = "";
  let subscriptionEvaluation = null;

  if (schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        isActive: true,
        name: true,
        plan: true,
        subscription: true,
      },
    });

    if (school) {
      schoolName = school.name;
      schoolPlan = school.plan;

      if (user.role !== "SUPER_ADMIN") {
        if (!school.isActive) {
          redirect("/suspended");
        }

        const { evaluateSubscriptionValidity } =
          await import("@/lib/subscription");
        subscriptionEvaluation = evaluateSubscriptionValidity(
          school.subscription || { plan: school.plan },
        );

        // If subscription or trial has fully expired, redirect to renewal
        if (subscriptionEvaluation.isExpired) {
          redirect("/expired");
        }

        schoolPlan = subscriptionEvaluation.plan;
      }
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden print:h-auto print:overflow-visible print:block print:bg-white">
      <Sidebar
        userRole={user.role}
        schoolName={schoolName}
        schoolPlan={schoolPlan}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:h-auto print:overflow-visible print:block">
        <Topbar
          user={user}
          subscription={subscriptionEvaluation}
          schoolPlan={schoolPlan}
        />
        <main className="flex-1 overflow-y-auto w-full print:h-auto print:overflow-visible print:block print:p-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
