import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { SchoolProfileContent } from "@/components/settings/school-profile-content";

export const metadata = { title: "School Profile" };

export default async function SchoolProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role);

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, address: true, phone: true, email: true, subdomain: true, plan: true },
  });
  if (!school) return <div className="p-6">School not found.</div>;

  return <SchoolProfileContent school={school} canEdit={canEdit} />;
}
