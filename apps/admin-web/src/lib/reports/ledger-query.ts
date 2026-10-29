/**
 * Ledger filters as URL search params (P2), shared by the ledger page (which
 * filters and totals in SQL) and the filter bar (which writes the URL).
 */

export type LedgerPeriod =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

/**
 * What the list shows. "all" is money in and out; advance credits and
 * settlements move money already counted, so they are listed only under
 * "advance".
 */
export type LedgerStream = "all" | "inflow" | "outflow" | "advance";

export interface LedgerQuery {
  period: LedgerPeriod;
  /** "YYYY-MM-DD", custom period only; either end may be open. */
  from: string | null;
  to: string | null;
  stream: LedgerStream;
  /** "all" or a payment method such as "UPI". */
  method: string;
  sessionId: string;
  classId: string;
  /** "all", "comp_<feeComponentId>" or "cat_<expenseCategoryId>". */
  item: string;
  q: string;
  /** 1-based page of the list; the totals always cover every matching row. */
  page: number;
}

export const LEDGER_PAGE_SIZE = 25;
/** Most rows one CSV export holds. */
export const LEDGER_EXPORT_MAX = 5000;

export const DEFAULT_LEDGER_QUERY: LedgerQuery = {
  period: "all",
  from: null,
  to: null,
  stream: "all",
  method: "all",
  sessionId: "all",
  classId: "all",
  item: "all",
  q: "",
  page: 1,
};

const PERIODS: LedgerPeriod[] = [
  "all",
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "last_month",
  "this_year",
  "custom",
];
const STREAMS: LedgerStream[] = ["all", "inflow", "outflow", "advance"];

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

const isIsoDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function parseLedgerQuery(params: Params): LedgerQuery {
  const period = first(params.period) as LedgerPeriod;
  const stream = first(params.stream) as LedgerStream;
  const method = first(params.method).toUpperCase();
  const item = first(params.item);
  let from = first(params.from);
  let to = first(params.to);
  if (isIsoDate(from) && isIsoDate(to) && from > to) [from, to] = [to, from];
  const page = parseInt(first(params.page), 10);
  const id = (v: string) => (v && v !== "all" ? v : "all");

  return {
    period: PERIODS.includes(period) ? period : "all",
    from: period === "custom" && isIsoDate(from) ? from : null,
    to: period === "custom" && isIsoDate(to) ? to : null,
    stream: STREAMS.includes(stream) ? stream : "all",
    method: /^[A-Z_]{2,30}$/.test(method) ? method : "all",
    sessionId: id(first(params.session)),
    classId: id(first(params.class)),
    item: /^(comp|cat)_.+/.test(item) ? item : "all",
    q: first(params.q).slice(0, 100),
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

/** Search string for a query, leaving out defaults ("" for the default view). */
export function ledgerQueryToSearch(query: LedgerQuery): string {
  const p = new URLSearchParams();
  const d = DEFAULT_LEDGER_QUERY;
  if (query.period !== d.period) p.set("period", query.period);
  if (query.period === "custom") {
    if (query.from) p.set("from", query.from);
    if (query.to) p.set("to", query.to);
  }
  if (query.stream !== d.stream) p.set("stream", query.stream);
  if (query.method !== d.method) p.set("method", query.method);
  if (query.sessionId !== d.sessionId) p.set("session", query.sessionId);
  if (query.classId !== d.classId) p.set("class", query.classId);
  if (query.item !== d.item) p.set("item", query.item);
  if (query.q.trim()) p.set("q", query.q.trim());
  if (query.page !== d.page) p.set("page", String(query.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

const shift = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const monthBounds = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

/**
 * The period as inclusive calendar dates, given today's date in the school's
 * time zone. `null` leaves that end open. Weeks start on Monday.
 */
export function resolveLedgerRange(
  query: Pick<LedgerQuery, "period" | "from" | "to">,
  today: string,
): { start: string | null; end: string | null } {
  const [year, month] = today.split("-").map(Number);
  switch (query.period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = shift(today, -1);
      return { start: y, end: y };
    }
    case "this_week": {
      const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      const start = shift(today, -weekday);
      return { start, end: shift(start, 6) };
    }
    case "this_month":
      return monthBounds(year, month);
    case "last_month":
      return month === 1
        ? monthBounds(year - 1, 12)
        : monthBounds(year, month - 1);
    case "this_year":
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    case "custom":
      return { start: query.from, end: query.to };
    default:
      return { start: null, end: null };
  }
}
