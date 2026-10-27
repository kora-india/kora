import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { can } from "@schoolos/types";
import { getPermissions } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { AttendanceTaker } from "@/components/attendance/attendance-taker";
import { BottomNav } from "@/components/layout/bottom-nav";
import { compareRollNumbers } from "@schoolos/types";
import { parseAttendanceDate, todayIn } from "@schoolos/utils";
import { getTeacherSections } from "@/lib/teacher-sections";

export const metadata = { title: "Take Attendance" };
export const dynamic = "force-dynamic";

export default async function TakeAttendancePage(
  props: Readonly<{ searchParams?: Promise<{ section?: string }> }>,
) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(await getPermissions(), "attendance", "manage")) redirect("/");

  const user = session.user;
  if (!user.schoolId) redirect("/login");
  const schoolId = user.schoolId;

  // U8: every section the teacher has, not only the legacy single one.
  const { sections } = await getTeacherSections(user.id, schoolId);
  const { section: sectionParam } = (await props.searchParams) ?? {};
  const selected =
    sections.find((s) => s.sectionId === sectionParam) ??
    (sections.length === 1 ? sections[0] : null);

  if (sections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pb-20">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            No class assigned. Contact admin.
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-background pb-20 max-w-lg mx-auto">
        <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-sm font-bold">Take Attendance</h1>
            <p className="text-[10px] text-muted-foreground">
              Choose a section
            </p>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {sections.map((s) => (
            <Link
              key={s.sectionId}
              href={`/attendance/take?section=${s.sectionId}`}
              className="bg-card border rounded-2xl p-4 flex items-center justify-between hover:bg-muted/50"
            >
              <span className="text-sm font-semibold">
                {s.className} · Section {s.sectionName}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  // Today in the school's time zone, stored as that day at UTC midnight.
  const date = todayIn(school?.timezone);

  const [rawStudents, existing] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        classId: selected.classId,
        sectionId: selected.sectionId,
        isActive: true,
      },
      select: { id: true, name: true, rollNumber: true },
    }),
    prisma.attendance.findMany({
      where: {
        schoolId,
        classId: selected.classId,
        sectionId: selected.sectionId,
        date: parseAttendanceDate(date)!,
      },
      select: { studentId: true, status: true },
    }),
  ]);

  const students = [...rawStudents].sort((a, b) =>
    compareRollNumbers(a.rollNumber, b.rollNumber),
  );

  const existingMap: Record<string, string> = {};
  existing.forEach((r) => {
    existingMap[r.studentId] = r.status;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <AttendanceTaker
        students={students}
        classId={selected.classId}
        sectionId={selected.sectionId}
        className={selected.className}
        sectionName={selected.sectionName}
        date={date}
        existingAttendance={existingMap}
        canChangeSection={sections.length > 1}
      />
      <BottomNav />
    </div>
  );
}
