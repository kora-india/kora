import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { StudentsContent } from "@/components/students/students-content";
import { getCache } from "@/lib/redis";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/auth-guard";

export const metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    classId?: string;
    sectionId?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) return <div className="p-6">No school assigned.</div>;

  const permissions = await getPermissions();
  if (!can(permissions, "students")) redirect("/dashboard");
  const canEdit = can(permissions, "students", "manage");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // C8: Server-side search & filtering support for large schools
  const resolvedParams = searchParams ? await searchParams : {};
  const query = resolvedParams.q?.trim();
  const classId = resolvedParams.classId?.trim();
  const sectionId = resolvedParams.sectionId?.trim();

  const where: any = { schoolId, isActive: true };
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { rollNumber: { contains: query, mode: "insensitive" } },
      { admissionNumber: { contains: query, mode: "insensitive" } },
      { parentPhone: { contains: query, mode: "insensitive" } },
      { parentName: { contains: query, mode: "insensitive" } },
    ];
  }

  const isFiltered = Boolean(query || classId || sectionId);
  const cacheKey = isFiltered
    ? `cache:${schoolId}:students:list:${classId || "all"}:${sectionId || "all"}:${query ? encodeURIComponent(query) : "all"}`
    : `cache:${schoolId}:students:list`;

  const students = await getCache(
    cacheKey,
    () =>
      prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          feeCharges: {
            where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
            select: {
              id: true,
              status: true,
              dueDate: true,
              title: true,
              items: {
                select: { amount: true, paidAmount: true, status: true },
              },
            },
          },
          attendances: {
            where: { date: today },
            select: { status: true, date: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: isFiltered ? 1000 : 5000,
      }),
    60,
  );

  // C1: Distinct cache key for classes with sections
  const classes = await getCache(`cache:${schoolId}:classes:withSections`, () =>
    prisma.class.findMany({
      where: { schoolId: schoolId },
      include: { sections: { select: { id: true, name: true } } },
      orderBy: { grade: "asc" },
      take: 200,
    }),
  );

  return (
    <StudentsContent
      students={students}
      classes={classes}
      canEdit={canEdit}
      appliedFilters={{
        q: query ?? "",
        classId: classId ?? "",
        sectionId: sectionId ?? "",
      }}
    />
  );
}
