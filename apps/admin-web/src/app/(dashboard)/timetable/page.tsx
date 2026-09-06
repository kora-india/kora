import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { TimetableContent } from "@/components/timetable/timetable-content";
import { getTimetable, getTimetablePeriods } from "@/lib/actions/timetable";

export const metadata = { title: "Timetable & Scheduling | SchoolOS" };

export default async function TimetablePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const schoolId = user.schoolId;
  if (!schoolId) {
    return <div className="p-6">No school assigned.</div>;
  }

  const [classes, teachers, periods] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      include: {
        sections: { orderBy: { name: "asc" } },
      },
      orderBy: { grade: "asc" },
    }),
    prisma.teacher.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: "asc" },
    }),
    getTimetablePeriods(),
  ]);

  const initialSectionId = classes[0]?.sections?.[0]?.id;
  const initialSlots = initialSectionId
    ? await getTimetable({ sectionId: initialSectionId })
    : [];

  return (
    <TimetableContent
      initialClasses={classes}
      initialTeachers={teachers}
      initialPeriods={periods as any}
      initialSlots={initialSlots}
      userRole={user.role}
    />
  );
}
