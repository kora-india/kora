/**
 * Year-end promotion, planned without touching the database; the promotion
 * actions (lib/actions/promotion.ts) apply the plan. Every current student
 * ends up somewhere: moved to the class their class goes to, kept where they
 * are, or marked as leaving.
 */

export type Destination =
  | { kind: "CLASS"; classId: string }
  | { kind: "GRADUATE" }
  | { kind: "STAY" };

export type PromotionException = "REPEAT" | "LEAVE";

export type PromotionAction =
  | "PROMOTED"
  | "REPEATED"
  | "STAYED"
  | "GRADUATED"
  | "LEFT";

export interface PlanClass {
  id: string;
  name: string;
  grade: number;
  sections: { id: string; name: string }[];
}

export interface PlanStudent {
  id: string;
  name: string;
  rollNumber: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
}

export interface PromotionInput {
  /** Where each class goes. A class left out stays where it is. */
  moves: { fromClassId: string; to: Destination }[];
  /** Students who don't go with their class. */
  exceptions: { studentId: string; action: PromotionException }[];
  /** Give every section new roll numbers, in order of name. */
  renumber: boolean;
}

interface Placement {
  classId: string;
  sectionId: string;
  rollNumber: string;
}

export interface PlannedMove {
  studentId: string;
  action: PromotionAction;
  from: Placement;
  to: Placement;
  /** False for students leaving the school. */
  active: boolean;
}

/** The class with the next higher grade, or graduation from the highest. */
export function defaultDestination(
  cls: PlanClass,
  classes: PlanClass[],
): Destination {
  const next = classes
    .filter((c) => c.grade > cls.grade)
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))[0];
  return next ? { kind: "CLASS", classId: next.id } : { kind: "GRADUATE" };
}

/** The target section: the one with the same name, or the first by name. */
function targetSection(target: PlanClass, fromSectionName: string | undefined) {
  const byName = [...target.sections].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { numeric: true }),
  );
  return (
    byName.find(
      (s) =>
        s.name.trim().toLowerCase() === fromSectionName?.trim().toLowerCase(),
    ) ?? byName[0]
  );
}

const byName = (a: PlanStudent, b: PlanStudent) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
  a.admissionNumber.localeCompare(b.admissionNumber, "en", { numeric: true });

export function planPromotion(
  classes: PlanClass[],
  students: PlanStudent[],
  input: PromotionInput,
): { moves: PlannedMove[] } | { error: string } {
  const classById = new Map(classes.map((c) => [c.id, c]));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const sectionName = new Map(
    classes.flatMap((c) => c.sections.map((s) => [s.id, s.name] as const)),
  );

  const destinations = new Map<string, Destination>();
  for (const move of input.moves) {
    const from = classById.get(move.fromClassId);
    if (!from) return { error: "A class in the plan isn't in your school" };
    if (move.to.kind === "CLASS") {
      const target = classById.get(move.to.classId);
      if (!target)
        return { error: `${from.name}'s next class isn't in your school` };
      if (target.id !== from.id && target.sections.length === 0) {
        return { error: `${target.name} has no sections. Add one first.` };
      }
    }
    destinations.set(from.id, move.to);
  }

  const exceptions = new Map<string, PromotionException>();
  for (const e of input.exceptions) {
    if (!studentById.has(e.studentId)) {
      return { error: "A student in the plan isn't a current student" };
    }
    exceptions.set(e.studentId, e.action);
  }

  const moves: PlannedMove[] = students.map((s) => {
    const from = {
      classId: s.classId,
      sectionId: s.sectionId,
      rollNumber: s.rollNumber,
    };
    const stay = (action: PromotionAction, active = true): PlannedMove => ({
      studentId: s.id,
      action,
      from,
      to: { ...from },
      active,
    });

    const exception = exceptions.get(s.id);
    if (exception === "LEAVE") return stay("LEFT", false);
    if (exception === "REPEAT") return stay("REPEATED");

    const destination = destinations.get(s.classId) ?? { kind: "STAY" };
    if (destination.kind === "GRADUATE") return stay("GRADUATED", false);
    if (destination.kind === "STAY" || destination.classId === s.classId) {
      return stay("STAYED");
    }
    const target = classById.get(destination.classId)!;
    const section = targetSection(target, sectionName.get(s.sectionId));
    return {
      studentId: s.id,
      action: "PROMOTED",
      from,
      to: {
        classId: target.id,
        sectionId: section.id,
        rollNumber: s.rollNumber,
      },
      active: true,
    };
  });

  // Roll numbers in each section where students end up.
  const bySection = new Map<string, PlannedMove[]>();
  for (const m of moves) {
    if (!m.active) continue;
    const list = bySection.get(m.to.sectionId) ?? [];
    list.push(m);
    bySection.set(m.to.sectionId, list);
  }

  if (input.renumber) {
    for (const list of bySection.values()) {
      list
        .sort((a, b) =>
          byName(studentById.get(a.studentId)!, studentById.get(b.studentId)!),
        )
        .forEach((m, i) => {
          m.to.rollNumber = String(i + 1);
        });
    }
  } else {
    const clashes: string[] = [];
    for (const [sectionId, list] of bySection) {
      const seen = new Map<string, string>();
      for (const m of list) {
        const key = m.to.rollNumber.trim().toLowerCase();
        const name = studentById.get(m.studentId)!.name;
        const other = seen.get(key);
        if (other) {
          const cls = classById.get(m.to.classId)!;
          clashes.push(
            `roll ${m.to.rollNumber} in ${cls.name}-${sectionName.get(sectionId)} (${other} and ${name})`,
          );
        } else {
          seen.set(key, name);
        }
      }
    }
    if (clashes.length > 0) {
      const more = clashes.length > 3 ? ` and ${clashes.length - 3} more` : "";
      return {
        error: `Roll numbers would clash: ${clashes.slice(0, 3).join("; ")}${more}. Choose new roll numbers, or fix these first.`,
      };
    }
  }

  return { moves };
}

/** How many students each action applies to. */
export function summarizePlan(moves: PlannedMove[]) {
  const counts: Record<PromotionAction, number> = {
    PROMOTED: 0,
    REPEATED: 0,
    STAYED: 0,
    GRADUATED: 0,
    LEFT: 0,
  };
  for (const m of moves) counts[m.action]++;
  return counts;
}
