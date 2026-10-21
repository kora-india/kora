/**
 * Attendance days (U13). Attendance is stored per calendar day at UTC
 * midnight ("2026-10-21" → 2026-10-21T00:00:00Z), and a day after today in
 * the school's time zone can't be marked.
 */

const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/** A usable IANA zone: "Asia/Kolkata (IST)" → "Asia/Kolkata"; unknown → Asia/Kolkata. */
export function schoolTimeZone(tz?: string | null): string {
  const name = tz?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!name) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: name });
    return name;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Today's date ("YYYY-MM-DD") in the given time zone. */
export function todayIn(timeZone?: string | null, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: schoolTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The calendar day of "YYYY-MM-DD" (or an ISO string) at UTC midnight. */
export function parseAttendanceDate(value: string): Date | null {
  const day = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())?.[1];
  if (!day) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  return isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day
    ? null
    : date;
}

/** Why `value` can't be an attendance day, or null when it can. */
export function attendanceDateError(
  value: string,
  timeZone?: string | null,
  now = new Date(),
): string | null {
  const date = parseAttendanceDate(value);
  if (!date) return "Choose a valid date";
  if (date.toISOString().slice(0, 10) > todayIn(timeZone, now)) {
    return "Attendance can't be marked for a future date";
  }
  return null;
}
