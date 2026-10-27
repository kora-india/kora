import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { UserRole, resolvePermissions } from "@schoolos/types";
import {
  TeamAccessContent,
  type TeamMember,
} from "@/components/settings/team-access-content";

export const metadata = { title: "Team & Access" };

export default async function TeamAccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  // School admins only: no permission opens this page.
  if (user.role !== UserRole.SCHOOL_ADMIN) redirect("/settings");
  if (!user.schoolId) redirect("/setup");

  const users = await prisma.user.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      role: { in: [UserRole.TEACHER, UserRole.ACCOUNTANT] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const members: TeamMember[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as TeamMember["role"],
    permissions: resolvePermissions(u.role, u.permissions),
    customized: u.permissions !== null,
  }));

  return <TeamAccessContent members={members} />;
}
