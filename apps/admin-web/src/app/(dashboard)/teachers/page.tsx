import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { TeachersContent } from "@/components/teachers/teachers-content";
import { can, isStaffRole } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";

export const metadata = { title: "Teachers & Staff" };

export default async function TeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;
  const permissions = await getPermissions();
  if (!can(permissions, "staff")) redirect("/dashboard");
  const canEdit = can(permissions, "staff", "manage");
  // Salaries are for those who may change them.
  const withPay = <T extends { salary: unknown }>(rows: T[]) =>
    canEdit ? rows : rows.map((row) => ({ ...row, salary: null }));

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: schoolId, isActive: true },
    include: {
      assignedClass: { select: { name: true } },
      assignedSection: { select: { name: true } },
      assignedSections: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      classTeacherOf: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const staffList = (prisma as any).staff
    ? await prisma.staff.findMany({
        where: { schoolId: schoolId, isActive: true },
        orderBy: { name: "asc" },
        take: 500,
      })
    : [];

  const classes = await prisma.class.findMany({
    where: { schoolId: schoolId },
    include: { sections: { select: { id: true, name: true } } },
    orderBy: { grade: "asc" },
    take: 200,
  });

  return (
    <TeachersContent
      teachers={withPay(teachers)}
      staffList={withPay(staffList)}
      classes={classes}
      canEdit={canEdit}
      canRunPayroll={!isStaffRole(user.role)}
    />
  );
}
