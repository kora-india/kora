import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { parseAttendanceDate, schoolTimeZone, todayIn } from "@schoolos/utils";
import { HomeContent, type TodaySlot } from "@/components/home/home-content";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getTeacherSections } from "@/lib/teacher-sections";

export const dynamic = "force-dynamic";

/** Weekday (1 = Mon … 7 = Sun) and "HH:MM" now, in the school's time zone. */
function schoolClock(timeZone: string | null | undefined) {
  const tz = schoolTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) +
    1;
  return { weekday, time: `${get("hour")}:${get("minute")}` };
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;

  let classLabel: string | null = null;
  let studentCount = 0;
  let sectionCount = 0;
  let pendingSections = 0;
  let upcomingAssignments = 0;
  let todaySlots: TodaySlot[] = [];

  if (user.schoolId) {
    const schoolId = user.schoolId;
    // U8: all of the teacher's sections, and today in the school's time zone.
    const [{ teacher, sections }, school] = await Promise.all([
      getTeacherSections(user.id, schoolId),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
      }),
    ]);
    sectionCount = sections.length;
    if (sections.length === 1) {
      classLabel = `${sections[0].className} — Section ${sections[0].sectionName}`;
    } else if (sections.length > 1) {
      classLabel = `${sections.length} sections`;
    }

    if (teacher && sections.length > 0) {
      const sectionIds = sections.map((s) => s.sectionId);
      const classIds = [...new Set(sections.map((s) => s.classId))];
      const date = parseAttendanceDate(todayIn(school?.timezone))!;
      const clock = schoolClock(school?.timezone);

      const [taken, students, assignments, slots] = await Promise.all([
        prisma.attendance.groupBy({
          by: ["sectionId"],
          where: { schoolId, date, sectionId: { in: sectionIds } },
        }),
        prisma.student.count({
          where: { schoolId, sectionId: { in: sectionIds }, isActive: true },
        }),
        prisma.assignment.count({
          where: {
            schoolId,
            classId: { in: classIds },
            dueDate: { gte: new Date() },
          },
        }),
        prisma.timetableSlot.findMany({
          where: { schoolId, teacherId: teacher.id, dayOfWeek: clock.weekday },
          select: {
            startTime: true,
            endTime: true,
            subjectName: true,
            room: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
          orderBy: { startTime: "asc" },
        }),
      ]);
      pendingSections = sections.length - taken.length;
      studentCount = students;
      upcomingAssignments = assignments;
      todaySlots = slots.map((s) => ({
        time: `${s.startTime} – ${s.endTime}`,
        subject: s.subjectName,
        place: [`${s.class.name} ${s.section.name}`, s.room]
          .filter(Boolean)
          .join(" · "),
        isNow: clock.time >= s.startTime && clock.time < s.endTime,
      }));
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HomeContent
        user={{ name: user.name, email: user.email }}
        classLabel={classLabel}
        studentCount={studentCount}
        sectionCount={sectionCount}
        pendingSections={pendingSections}
        upcomingAssignments={upcomingAssignments}
        todaySlots={todaySlots}
      />
      <BottomNav />
    </div>
  );
}
