/**
 * Standard class catalog used by the "Create Class" flow.
 *
 * `Class.grade` in the database is used purely as a sort key across the app
 * (`orderBy: { grade: "asc" }`), so every class — standard or custom — maps to
 * an integer "display order" on the same scale:
 *
 *   Nursery = -2, LKG = -1, UKG = 0, Grade N = N
 *
 * Categories are derived from that order, so no extra column is needed.
 * Edit the arrays below to change grouping or add standard classes.
 */

export type ClassCategoryId =
  | "pre-primary"
  | "primary"
  | "middle"
  | "secondary"
  | "senior-secondary"
  | "other";

export interface ClassCategory {
  id: ClassCategoryId;
  /** Name used in the custom class form ("Pre-Primary"). */
  label: string;
  /** Heading used when grouping the class dropdown ("Early Years"). */
  groupLabel: string;
  hint: string;
  /** Inclusive display-order range that belongs to this category. */
  min: number;
  max: number;
  /** Suggested display order for a new custom class in this category. */
  defaultOrder: number;
}

export const DISPLAY_ORDER_MIN = -10;
export const DISPLAY_ORDER_MAX = 50;

export const CLASS_CATEGORIES: ClassCategory[] = [
  {
    id: "pre-primary",
    label: "Pre-Primary",
    groupLabel: "Early Years",
    hint: "Nursery, LKG, UKG, Prep etc.",
    min: DISPLAY_ORDER_MIN,
    max: 0,
    defaultOrder: -3,
  },
  {
    id: "primary",
    label: "Primary",
    groupLabel: "Primary",
    hint: "Grade 1 – Grade 5",
    min: 1,
    max: 5,
    defaultOrder: 1,
  },
  {
    id: "middle",
    label: "Middle School",
    groupLabel: "Middle School",
    hint: "Grade 6 – Grade 8",
    min: 6,
    max: 8,
    defaultOrder: 6,
  },
  {
    id: "secondary",
    label: "Secondary",
    groupLabel: "Secondary",
    hint: "Grade 9 – Grade 10",
    min: 9,
    max: 10,
    defaultOrder: 9,
  },
  {
    id: "senior-secondary",
    label: "Senior Secondary",
    groupLabel: "Senior Secondary",
    hint: "Grade 11 – Grade 13",
    min: 11,
    max: 13,
    defaultOrder: 11,
  },
  {
    id: "other",
    label: "Other",
    groupLabel: "Other",
    hint: "Anything that doesn't fit above",
    min: DISPLAY_ORDER_MIN,
    max: DISPLAY_ORDER_MAX,
    defaultOrder: 14,
  },
];

export interface StandardClass {
  name: string;
  order: number;
}

export const STANDARD_CLASSES: StandardClass[] = [
  { name: "Nursery", order: -2 },
  { name: "LKG", order: -1 },
  { name: "UKG", order: 0 },
  ...Array.from({ length: 13 }, (_, i) => ({
    name: `Grade ${i + 1}`,
    order: i + 1,
  })),
];

export const CLASS_NAME_MAX = 40;
export const SECTION_NAME_MAX = 20;
export const MAX_SECTIONS = 30;

// Letters/digits first, then letters, digits, spaces and a few separators.
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .&'()/_-]*$/u;

export function getCategory(id: ClassCategoryId): ClassCategory {
  return CLASS_CATEGORIES.find((c) => c.id === id) ?? CLASS_CATEGORIES[5];
}

/** Category a class belongs to, based on its display order. */
export function categoryForOrder(order: number): ClassCategory {
  return (
    CLASS_CATEGORIES.find(
      (c) => c.id !== "other" && order >= c.min && order <= c.max,
    ) ?? getCategory("other")
  );
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

export function validateClassName(raw: string): string | null {
  const name = normalizeName(raw);
  if (!name) return "Class name is required";
  if (name.length > CLASS_NAME_MAX)
    return `Keep it under ${CLASS_NAME_MAX} characters`;
  if (!NAME_PATTERN.test(name))
    return "Use letters, numbers, spaces and - . & ' ( ) /";
  return null;
}

export function validateSectionName(raw: string): string | null {
  const name = normalizeName(raw);
  if (!name) return "Section name can't be empty";
  if (name.length > SECTION_NAME_MAX)
    return `Section names can be at most ${SECTION_NAME_MAX} characters`;
  if (!NAME_PATTERN.test(name))
    return "Use letters, numbers, spaces and - . & ' ( ) /";
  return null;
}

/** "Grade 8" + "A" → "8-A"; "Nursery" + "A" → "Nursery-A". */
export function sectionLabel(className: string, section: string): string {
  const match = /^grade\s+(\d+)$/i.exec(normalizeName(className));
  return `${match ? match[1] : normalizeName(className)}-${section}`;
}

/** Compact badge text for a class: "Grade 8" → "8", "Montessori 1" → "M1". */
export function classShortLabel(className: string): string {
  const name = normalizeName(className);
  const grade = /^grade\s+(\d+)$/i.exec(name);
  if (grade) return grade[1];
  const words = name.split(" ").filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 3)
      .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
      .join("")
      .slice(0, 4);
  }
  const word = words[0] ?? "";
  if (word.length <= 3) return word.toUpperCase();
  return word[0].toUpperCase() + word.slice(1, 2);
}
