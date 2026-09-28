export interface ProfileTeacher {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  qualification: string | null;
  salary: number | null;
  joiningDate: string | null;
  isActive: boolean;
  assignedClassId: string | null;
  assignedSectionId: string | null;
  assignedClass: { id: string; name: string } | null;
  assignedSection: { id: string; name: string } | null;
  classTeacherOf: { id: string; name: string }[];
  assignedSections: {
    id: string;
    classId: string;
    sectionId: string;
    class: { id: string; name: string; grade: number };
    section: { id: string; name: string };
  }[];
}

export interface ProfileSchool {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Grade 1" + "A" → "Grade 1-A"; "LKG" + "B" → "LKG-B". */
export function classSectionLabel(className: string, sectionName: string) {
  return `${className}-${sectionName}`;
}

/** Teaching classes, falling back to the legacy single assignment. */
export function teachingClasses(t: ProfileTeacher) {
  if (t.assignedSections.length > 0) {
    return t.assignedSections.map((a) => ({
      key: a.id,
      classId: a.class.id,
      className: a.class.name,
      label: classSectionLabel(a.class.name, a.section.name),
    }));
  }
  if (t.assignedClass) {
    return [
      {
        key: "legacy",
        classId: t.assignedClass.id,
        className: t.assignedClass.name,
        label: t.assignedSection
          ? classSectionLabel(t.assignedClass.name, t.assignedSection.name)
          : t.assignedClass.name,
      },
    ];
  }
  return [];
}
