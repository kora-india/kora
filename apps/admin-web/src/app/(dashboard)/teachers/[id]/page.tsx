import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { notFound, redirect } from "next/navigation";
import { TeacherProfile } from "@/components/teachers/profile/teacher-profile";
import { serializeSlip, type SalarySlipRecord } from "@/lib/payroll";

export const metadata = { title: "Teacher Profile" };

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role))
    redirect("/dashboard");

  const [teacher, classes, school] = await Promise.all([
    prisma.teacher.findFirst({
      where: { id, schoolId },
      include: {
        assignedClass: { select: { id: true, name: true } },
        assignedSection: { select: { id: true, name: true } },
        assignedSections: {
          include: {
            class: { select: { id: true, name: true, grade: true } },
            section: { select: { id: true, name: true } },
          },
        },
        classTeacherOf: { select: { id: true, name: true } },
      },
    }),
    prisma.class.findMany({
      where: { schoolId },
      include: { sections: { select: { id: true, name: true } } },
      orderBy: { grade: "asc" },
      take: 200,
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        logoUrl: true,
      },
    }),
  ]);

  if (!teacher) notFound();

  // Payroll tables are new; keep the profile usable if they haven't been
  // created in this database yet.
  let slips: SalarySlipRecord[] = [];
  let payrollReady = true;
  try {
    const rows = await prisma.salarySlip.findMany({
      where: { teacherId: teacher.id, schoolId },
      include: { payouts: { orderBy: { createdAt: "desc" } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 120,
    });
    slips = rows.map(serializeSlip);
  } catch (e: any) {
    if (e?.code === "P2021" || e?.code === "P2022") payrollReady = false;
    else throw e;
  }

  const teacherData = {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    subject: teacher.subject,
    qualification: teacher.qualification,
    salary: teacher.salary == null ? null : Number(teacher.salary),
    joiningDate: teacher.joiningDate ? teacher.joiningDate.toISOString() : null,
    isActive: teacher.isActive,
    assignedClassId: teacher.assignedClassId,
    assignedSectionId: teacher.assignedSectionId,
    assignedClass: teacher.assignedClass,
    assignedSection: teacher.assignedSection,
    classTeacherOf: teacher.classTeacherOf,
    assignedSections: teacher.assignedSections
      .map((a) => ({
        id: a.id,
        classId: a.classId,
        sectionId: a.sectionId,
        class: { id: a.class.id, name: a.class.name, grade: a.class.grade },
        section: a.section,
      }))
      .sort(
        (a, b) =>
          a.class.grade - b.class.grade ||
          a.section.name.localeCompare(b.section.name),
      ),
  };

  return (
    <TeacherProfile
      teacher={teacherData}
      classes={classes}
      slips={slips}
      payrollReady={payrollReady}
      school={school}
    />
  );
}
