import { first, isIsoDate, monthBounds, shift } from "./ledger-query";

/**
 * Analytics filters as URL search params, shared by the page (which works out
 * the figures) and the filter bar (which writes the URL). Everything on the
 * page covers the one period, class and section these describe.
 */

export type AnalyticsPeriod =
  | "session"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "custom";

export const RECENT_PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
];

export interface AnalyticsQuery {
  period: AnalyticsPeriod;
  /** The academic session shown, for the "session" period. */
  sessionId: string;
  /** "YYYY-MM-DD", custom period only. */
  from: string | null;
  to: string | null;
  classId: string;
  /** Only with a class. */
  sectionId: string;
}

export interface SessionOption {
  id: string;
  name: string;
  /** "YYYY-MM-DD" */
  start: string;
  end: string;
  isCurrent: boolean;
}

export interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

/** Inclusive calendar dates in the school's time zone. */
export interface AnalyticsRange {
  from: string;
  to: string;
}

type Params = Record<string, string | string[] | undefined>;

/** The session the page opens on: the current one, once it has begun. */
export function defaultSession(sessions: SessionOption[], today: string) {
  const begun = sessions.filter((s) => s.start <= today);
  return begun.find((s) => s.isCurrent) ?? begun[0] ?? null;
}

export const defaultAnalyticsQuery = (
  session: { id: string } | null,
): AnalyticsQuery => ({
  period: session ? "session" : "last_6_months",
  sessionId: session?.id ?? "",
  from: null,
  to: null,
  classId: "all",
  sectionId: "all",
});

export function parseAnalyticsQuery(
  params: Params,
  defaults: AnalyticsQuery,
): AnalyticsQuery {
  const period = first(params.period) as AnalyticsPeriod;
  const session = first(params.session);
  let from = first(params.from);
  let to = first(params.to);
  if (from > to) [from, to] = [to, from];
  const custom = period === "custom" && isIsoDate(from) && isIsoDate(to);
  const recent = RECENT_PERIODS.some((p) => p.value === period);

  const chosen: Pick<AnalyticsQuery, "period" | "sessionId"> = custom
    ? { period, sessionId: "" }
    : recent
      ? { period, sessionId: "" }
      : session
        ? { period: "session", sessionId: session }
        : { period: defaults.period, sessionId: defaults.sessionId };

  const classId = first(params.class) || "all";
  return {
    ...chosen,
    from: custom ? from : null,
    to: custom ? to : null,
    classId,
    sectionId: classId === "all" ? "all" : first(params.section) || "all",
  };
}

/** Search string for a query, leaving out defaults ("" for the default view). */
export function analyticsQueryToSearch(
  query: AnalyticsQuery,
  defaults: AnalyticsQuery,
): string {
  const p = new URLSearchParams();
  if (query.period === "session") {
    if (query.sessionId !== defaults.sessionId) {
      p.set("session", query.sessionId);
    }
  } else if (query.period !== defaults.period) {
    p.set("period", query.period);
  }
  if (query.period === "custom") {
    p.set("from", query.from ?? "");
    p.set("to", query.to ?? "");
  }
  if (query.classId !== "all") p.set("class", query.classId);
  if (query.sectionId !== "all") p.set("section", query.sectionId);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * The period's whole dates. Months and sessions run to their last day even if
 * that's ahead, so bills due later this month count; payments and attendance
 * simply don't exist yet.
 */
export function resolveAnalyticsRange(
  query: AnalyticsQuery,
  sessions: SessionOption[],
  today: string,
): AnalyticsRange {
  const [year, month] = today.split("-").map(Number);
  const months = (back: number): AnalyticsRange => ({
    from: monthBounds(year, month - back).start,
    to: monthBounds(year, month).end,
  });
  switch (query.period) {
    case "session": {
      const session = sessions.find((s) => s.id === query.sessionId);
      if (session) return { from: session.start, to: session.end };
      return months(5);
    }
    case "this_month":
      return months(0);
    case "last_month": {
      const { start, end } = monthBounds(year, month - 1);
      return { from: start, to: end };
    }
    case "last_3_months":
      return months(2);
    case "custom":
      return { from: query.from!, to: query.to! };
    default:
      return months(5);
  }
}

const COMPARE: Record<
  Exclude<AnalyticsPeriod, "custom">,
  { months: number; label: string }
> = {
  session: { months: 12, label: "vs same dates last year" },
  this_month: { months: 1, label: "vs same days last month" },
  last_month: { months: 1, label: "vs the month before" },
  last_3_months: { months: 3, label: "vs the 3 months before" },
  last_6_months: { months: 6, label: "vs the 6 months before" },
};

/** The same calendar date `months` earlier, or that month's last day. */
function monthsBefore(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const { end } = monthBounds(year, month - months);
  const lastDay = Number(end.slice(8));
  return `${end.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

const dayCount = ({ from, to }: AnalyticsRange) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  ) + 1;

/**
 * What to compare revenue with: the like-for-like dates before this period, up
 * to today. A month in progress isn't set against a whole month.
 */
export function previousRange(
  query: AnalyticsQuery,
  range: AnalyticsRange,
  today: string,
): { range: AnalyticsRange; label: string } {
  const to = range.to < today ? range.to : today;
  if (query.period === "custom") {
    const days = dayCount({ from: range.from, to });
    return {
      range: { from: shift(range.from, -days), to: shift(range.from, -1) },
      label: `vs the ${days} day${days === 1 ? "" : "s"} before`,
    };
  }
  const { months, label } = COMPARE[query.period];
  return {
    range: {
      from: monthsBefore(range.from, months),
      to: monthsBefore(to, months),
    },
    label,
  };
}

/** Longest period shown day by day; a monthly chart would have 1 or 2 points. */
const MAX_DAILY_DAYS = 62;

const dateLabel = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/** The chart's points: days for a short period, otherwise months. */
export function analyticsBuckets(range: AnalyticsRange, today: string) {
  const unit = dayCount(range) <= MAX_DAILY_DAYS ? "day" : "month";
  // Nothing happens beyond this month, so a session doesn't trail off to March.
  const [year, month] = today.split("-").map(Number);
  const monthEnd = monthBounds(year, month).end;
  const last = range.to < monthEnd ? range.to : monthEnd;

  if (unit === "day") {
    const buckets: { key: string; label: string }[] = [];
    for (let d = range.from; d <= last; d = shift(d, 1)) {
      buckets.push({
        key: d,
        label: dateLabel(d, { day: "numeric", month: "short" }),
      });
    }
    return { unit, buckets } as const;
  }

  const keys: string[] = [];
  const [fromYear, fromMonth] = range.from.split("-").map(Number);
  for (let m = 0; ; m++) {
    const { start } = monthBounds(fromYear, fromMonth + m);
    if (start > last) break;
    keys.push(start);
  }
  const options: Intl.DateTimeFormatOptions =
    keys.length > 12 ? { month: "short", year: "2-digit" } : { month: "short" };
  return {
    unit,
    buckets: keys.map((start) => ({
      key: start.slice(0, 7),
      label: dateLabel(start, options),
    })),
  } as const;
}

/** "1 Apr 2026 – 31 Mar 2027", or "1 – 30 Nov 2026" within a month. */
export function rangeLabel({ from, to }: AnalyticsRange) {
  const end = dateLabel(to, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (from === to) return end;
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = dateLabel(
    from,
    sameMonth
      ? { day: "numeric" }
      : sameYear
        ? { day: "numeric", month: "short" }
        : { day: "numeric", month: "short", year: "numeric" },
  );
  return `${start} – ${end}`;
}

/** The URL's filters, checked against the school's sessions and classes. */
export function resolveAnalyticsView(
  params: Params,
  context: {
    sessions: SessionOption[];
    classes: ClassOption[];
    today: string;
  },
) {
  const { sessions, classes, today } = context;
  const defaults = defaultAnalyticsQuery(defaultSession(sessions, today));
  const query = parseAnalyticsQuery(params, defaults);

  const session = sessions.find((s) => s.id === query.sessionId);
  if (query.period === "session" && !(session && session.start <= today)) {
    query.period = defaults.period;
    query.sessionId = defaults.sessionId;
  }
  const chosenClass = classes.find((c) => c.id === query.classId);
  if (!chosenClass) query.classId = "all";
  if (!chosenClass?.sections.some((s) => s.id === query.sectionId)) {
    query.sectionId = "all";
  }

  const range = resolveAnalyticsRange(query, sessions, today);
  const compare = previousRange(query, range, today);
  const section = chosenClass?.sections.find((s) => s.id === query.sectionId);
  return {
    query,
    defaults,
    range,
    previous: compare.range,
    compareLabel: compare.label,
    isDefault: analyticsQueryToSearch(query, defaults) === "",
    summary: [
      rangeLabel(range),
      chosenClass ? chosenClass.name : "All classes",
      ...(section ? [`Section ${section.name}`] : []),
    ].join(" · "),
  };
}
