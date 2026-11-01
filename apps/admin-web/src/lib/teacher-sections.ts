import { prisma } from "@schoolos/db";

/** The classes and sections a teacher login is assigned to. */
export function findTeacherSections(userId: string, schoolId: string) {
  return prisma.teacher.findFirst({
    where: { userId, schoolId },
    select: {
      assignedClassId: true,
      assignedSectionId: true,
      assignedSections: { select: { classId: true, sectionId: true } },
      classTeacherOf: { select: { id: true } },
    },
  });
}

type TeacherSections = NonNullable<
  Awaited<ReturnType<typeof findTeacherSections>>
>;

/** Assigned to the section, or to its whole class. */
export function teachesSection(
  teacher: TeacherSections,
  classId: string,
  sectionId: string,
) {
  return (
    (teacher.assignedClassId === classId &&
      (!teacher.assignedSectionId ||
        teacher.assignedSectionId === sectionId)) ||
    teacher.assignedSections.some(
      (s) => s.classId === classId && s.sectionId === sectionId,
    ) ||
    teacher.classTeacherOf.some((c) => c.id === classId)
  );
}
