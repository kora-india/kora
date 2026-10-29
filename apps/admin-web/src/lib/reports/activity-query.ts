/**
 * Activity log filters as URL search params, shared by the ledger page's
 * Activity tab (which filters in SQL) and its filter bar (which writes the URL).
 */

import { isActivityModule } from "@/lib/activity-labels";
import type { LedgerPeriod } from "./ledger-query";

export interface ActivityQuery {
  /** "all", "system" (automatic jobs) or a user id. */
  who: string;
  /** "all" or an activity module (lib/activity-labels.ts). */
  module: string;
  period: LedgerPeriod;
  /** "YYYY-MM-DD", custom period only; either end may be open. */
  from: string | null;
  to: string | null;
  q: string;
  /** 1-based page. */
  page: number;
}

export const ACTIVITY_PAGE_SIZE = 50;

export const DEFAULT_ACTIVITY_QUERY: ActivityQuery = {
  who: "all",
  module: "all",
  period: "all",
  from: null,
  to: null,
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

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

const isIsoDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function parseActivityQuery(params: Params): ActivityQuery {
  const period = first(params.period) as LedgerPeriod;
  const who = first(params.who);
  const area = first(params.module);
  let from = first(params.from);
  let to = first(params.to);
  if (isIsoDate(from) && isIsoDate(to) && from > to) [from, to] = [to, from];
  const page = parseInt(first(params.page), 10);

  return {
    who: /^[\w-]{1,64}$/.test(who) ? who : "all",
    module: isActivityModule(area) ? area : "all",
    period: PERIODS.includes(period) ? period : "all",
    from: period === "custom" && isIsoDate(from) ? from : null,
    to: period === "custom" && isIsoDate(to) ? to : null,
    q: first(params.q).slice(0, 100),
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

/** Search string for the Activity tab, leaving out defaults. */
export function activityQueryToSearch(query: ActivityQuery): string {
  const p = new URLSearchParams({ tab: "activity" });
  const d = DEFAULT_ACTIVITY_QUERY;
  if (query.who !== d.who) p.set("who", query.who);
  if (query.module !== d.module) p.set("module", query.module);
  if (query.period !== d.period) p.set("period", query.period);
  if (query.period === "custom") {
    if (query.from) p.set("from", query.from);
    if (query.to) p.set("to", query.to);
  }
  if (query.q.trim()) p.set("q", query.q.trim());
  if (query.page !== d.page) p.set("page", String(query.page));
  return `?${p.toString()}`;
}
