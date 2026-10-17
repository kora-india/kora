/** "Removed as class teacher of 2 classes and from 14 timetable periods." */
export function describeReleasedAssignments(result: {
  releasedClasses?: number;
  releasedPeriods?: number;
}): string {
  const parts: string[] = [];
  if (result.releasedClasses) {
    parts.push(
      `class teacher of ${result.releasedClasses} class${result.releasedClasses === 1 ? "" : "es"}`,
    );
  }
  if (result.releasedPeriods) {
    parts.push(
      `${result.releasedPeriods} timetable period${result.releasedPeriods === 1 ? "" : "s"}`,
    );
  }
  return parts.length > 0 ? ` Unassigned from ${parts.join(" and ")}.` : "";
}
