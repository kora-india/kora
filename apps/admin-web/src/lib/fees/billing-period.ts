/**
 * Billing-period helpers shared by the fee generator (server) and the
 * generator UI (client). Pure functions only — no database access.
 *
 * A billing period is a calendar month identified by a period key "YYYY-MM".
 * Each fee component is billed at most once per "bucket": every month for
 * MONTHLY, every 3 months of the session for QUARTERLY, every 6 for
 * HALF_YEARLY, once per session for YEARLY and once per student for ONE_TIME.
 * A non-monthly component is billed in the first generated month of its
 * bucket, so a school that starts generating mid-quarter still bills it.
 */

export type BillingFrequency =
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "YEARLY"
  | "ONE_TIME"
  | "CUSTOM";

const PERIOD_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function toPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parsePeriodKey(
  key: string | null | undefined,
): { year: number; month: number } | null {
  const match = key ? PERIOD_KEY_RE.exec(key) : null;
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isPeriodKey(key: string | null | undefined): key is string {
  return parsePeriodKey(key) !== null;
}

/** Period key of a date, read in UTC (dates from `@db.Date` columns are UTC midnight). */
export function periodKeyFromDate(date: Date): string {
  return toPeriodKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

/** "2026-10" → "October 2026" */
export function formatPeriodLabel(key: string): string {
  const p = parsePeriodKey(key);
  if (!p) return key;
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

function monthOrdinal(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/** Months from the session's first month to the billing month (0 = first month). */
export function monthsIntoSession(
  sessionStart: Date,
  periodKey: string,
): number {
  const p = parsePeriodKey(periodKey);
  if (!p) throw new Error(`Invalid billing month "${periodKey}"`);
  return (
    monthOrdinal(p.year, p.month) -
    monthOrdinal(sessionStart.getUTCFullYear(), sessionStart.getUTCMonth() + 1)
  );
}

/** True when the billing month falls inside the session's start and end months. */
export function isPeriodWithinSession(
  periodKey: string,
  sessionStart: Date,
  sessionEnd: Date,
): boolean {
  const p = parsePeriodKey(periodKey);
  if (!p) return false;
  const target = monthOrdinal(p.year, p.month);
  const start = monthOrdinal(
    sessionStart.getUTCFullYear(),
    sessionStart.getUTCMonth() + 1,
  );
  const end = monthOrdinal(
    sessionEnd.getUTCFullYear(),
    sessionEnd.getUTCMonth() + 1,
  );
  return target >= start && target <= end;
}

/**
 * The bucket a component falls in for a billing month, or null when the
 * component is never billed automatically (CUSTOM is billed by hand).
 * Two months with the same bucket must not both bill the component.
 */
export function billingBucket(
  frequency: BillingFrequency | string,
  sessionStart: Date,
  periodKey: string,
): string | null {
  const m = monthsIntoSession(sessionStart, periodKey);
  switch (frequency) {
    case "MONTHLY":
      return `M:${periodKey}`;
    case "QUARTERLY":
      return `Q:${Math.floor(m / 3)}`;
    case "HALF_YEARLY":
      return `H:${Math.floor(m / 6)}`;
    case "YEARLY":
      return "Y";
    case "ONE_TIME":
      return "ONCE";
    default:
      return null;
  }
}

/**
 * Whether a component is due for a student in the billing month, given the
 * buckets already billed for that student and component.
 */
export function isComponentDue(
  frequency: BillingFrequency | string,
  sessionStart: Date,
  periodKey: string,
  billedBuckets: ReadonlySet<string>,
): boolean {
  const bucket = billingBucket(frequency, sessionStart, periodKey);
  if (bucket === null) return false;
  return !billedBuckets.has(bucket);
}
