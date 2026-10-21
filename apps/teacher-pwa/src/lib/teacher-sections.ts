import { prisma } from "@schoolos/db";

export interface TeacherSection {
  classId: string;
  className: string;
  grade: number;
  sectionId: string;
  sectionName: string;
}

/**
 * Every section a teacher can take attendance for (U8): sections assigned in
 * Teachers (TeacherSection), the legacy single class/section on the teacher,
 * and all sections of classes they are class teacher of. The attendance API
 * allows exactly these.
 */
export async function getTeacherSections(userId: string, schoolId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId },
    select: {
      id: true,
      assignedClassId: true,
      assignedSectionId: true,
      assignedSections: { select: { classId: true, sectionId: true } },
      classTeacherOf: { select: { id: true } },
    },
  });
  if (!teacher) return { teacher: null, sections: [] as TeacherSection[] };

  const whole = new Set(teacher.classTeacherOf.map((c) => c.id));
  // A legacy class without a section covers the whole class.
  if (teacher.assignedClassId && !teacher.assignedSectionId) {
    whole.add(teacher.assignedClassId);
  }
  const single = new Set(
    teacher.assignedSections.map((s) => s.sectionId).filter(Boolean),
  );
  if (teacher.assignedSectionId) single.add(teacher.assignedSectionId);

  const rows = await prisma.section.findMany({
    where: {
      schoolId,
      OR: [{ id: { in: [...single] } }, { classId: { in: [...whole] } }],
    },
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true, grade: true } },
    },
  });

  const sections: TeacherSection[] = rows
    .map((s) => ({
      classId: s.class.id,
      className: s.class.name,
      grade: s.class.grade,
      sectionId: s.id,
      sectionName: s.name,
    }))
    .sort(
      (a, b) =>
        a.grade - b.grade ||
        a.className.localeCompare(b.className) ||
        a.sectionName.localeCompare(b.sectionName),
    );
  return { teacher, sections };
}

/** Whether the teacher may mark this class and section. */
export function canTakeSection(
  sections: TeacherSection[],
  classId: string,
  sectionId: string,
) {
  return sections.some(
    (s) => s.classId === classId && s.sectionId === sectionId,
  );
}
