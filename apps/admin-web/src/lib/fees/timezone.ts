export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns a stored school time zone into a valid IANA name. The setup wizard
 * has saved values like "Asia/Kolkata (IST)", which Intl rejects.
 */
export function resolveTimeZone(tz?: string | null): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  const trimmed = tz.trim();
  if (isValidTimeZone(trimmed)) return trimmed;
  const stripped = trimmed.replace(/\s*\(.*\)\s*$/, "");
  if (stripped && isValidTimeZone(stripped)) return stripped;
  return DEFAULT_TIME_ZONE;
}

/** "YYYY-MM-DD" for the given instant in the given time zone. */
export function calendarDateInTimeZone(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Today's calendar date in the time zone, as a UTC-midnight Date — the same
 * shape Prisma returns for `@db.Date` columns, so the two compare directly.
 */
export function todayInTimeZone(tz?: string | null, now = new Date()): Date {
  return new Date(
    `${calendarDateInTimeZone(resolveTimeZone(tz), now)}T00:00:00.000Z`,
  );
}

/** Receipt timestamp. Kept in en-US order because the receipt modal re-parses it. */
export function formatDateTimeInTimeZone(
  date: Date,
  tz?: string | null,
): string {
  return date.toLocaleString("en-US", {
    timeZone: resolveTimeZone(tz),
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
