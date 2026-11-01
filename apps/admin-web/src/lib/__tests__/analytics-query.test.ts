import { describe, it, expect } from "vitest";
import {
  analyticsBuckets,
  analyticsQueryToSearch,
  defaultAnalyticsQuery,
  defaultSession,
  parseAnalyticsQuery,
  previousRange,
  rangeLabel,
  resolveAnalyticsRange,
  resolveAnalyticsView,
  type AnalyticsQuery,
  type SessionOption,
} from "../reports/analytics-query";

const TODAY = "2026-11-12";

const sessions: SessionOption[] = [
  {
    id: "next",
    name: "2027-28",
    start: "2027-04-01",
    end: "2028-03-31",
    isCurrent: false,
  },
  {
    id: "now",
    name: "2026-27",
    start: "2026-04-01",
    end: "2027-03-31",
    isCurrent: true,
  },
  {
    id: "past",
    name: "2025-26",
    start: "2025-04-01",
    end: "2026-03-31",
    isCurrent: false,
  },
];
const classes = [
  { id: "c4", name: "Class 4", sections: [{ id: "a", name: "A" }] },
  { id: "c5", name: "Class 5", sections: [{ id: "b", name: "B" }] },
];

const view = (params: Record<string, string> = {}, today = TODAY) =>
  resolveAnalyticsView(params, { sessions, classes, today });

const period = (p: AnalyticsQuery["period"]) => ({
  ...defaultAnalyticsQuery(null),
  period: p,
});

describe("the opening view", () => {
  it("is the current session", () => {
    const { query, range, isDefault } = view();
    expect(query).toMatchObject({ period: "session", sessionId: "now" });
    expect(range).toEqual({ from: "2026-04-01", to: "2027-03-31" });
    expect(isDefault).toBe(true);
  });

  it("waits for a session that hasn't begun", () => {
    expect(defaultSession(sessions, "2026-03-31")?.id).toBe("past");
  });

  it("falls back to six months for a school with no session", () => {
    const { query, range } = resolveAnalyticsView(
      {},
      { sessions: [], classes, today: TODAY },
    );
    expect(query.period).toBe("last_6_months");
    expect(range).toEqual({ from: "2026-06-01", to: "2026-11-30" });
  });
});

describe("periods", () => {
  it.each([
    ["this_month", "2026-11-01", "2026-11-30"],
    ["last_month", "2026-10-01", "2026-10-31"],
    ["last_3_months", "2026-09-01", "2026-11-30"],
    ["last_6_months", "2026-06-01", "2026-11-30"],
  ] as const)("works out %s", (p, from, to) => {
    expect(resolveAnalyticsRange(period(p), sessions, TODAY)).toEqual({
      from,
      to,
    });
  });

  it("crosses into last year in January", () => {
    expect(
      resolveAnalyticsRange(period("last_month"), sessions, "2027-01-15"),
    ).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(
      resolveAnalyticsRange(period("last_3_months"), sessions, "2027-01-15"),
    ).toEqual({ from: "2026-11-01", to: "2027-01-31" });
  });

  it("shows a past session", () => {
    expect(view({ session: "past" }).range).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    });
  });

  it("takes custom dates, either way round", () => {
    const { query, range } = view({
      period: "custom",
      from: "2026-08-20",
      to: "2026-08-05",
    });
    expect(query.period).toBe("custom");
    expect(range).toEqual({ from: "2026-08-05", to: "2026-08-20" });
  });
});

describe("a URL that doesn't make sense", () => {
  it.each([
    [{ period: "someday" }],
    [{ period: "custom" }],
    [{ period: "custom", from: "2026-08-05" }],
    [{ period: "custom", from: "2026-02-31", to: "2026-03-01" }],
    [{ session: "another-schools" }],
    [{ session: "next" }], // hasn't begun
  ])("opens the normal view for %j", (params) => {
    expect(view(params as Record<string, string>).query).toMatchObject({
      period: "session",
      sessionId: "now",
    });
  });

  it("drops a class from another school", () => {
    expect(view({ class: "theirs" }).query.classId).toBe("all");
  });

  it("drops a section from another class", () => {
    const { query } = view({ class: "c4", section: "b" });
    expect(query).toMatchObject({ classId: "c4", sectionId: "all" });
  });

  it("ignores a section with no class", () => {
    expect(view({ section: "a" }).query.sectionId).toBe("all");
  });
});

describe("the URL", () => {
  const { defaults } = view();

  it("says nothing for the opening view", () => {
    expect(analyticsQueryToSearch(defaults, defaults)).toBe("");
  });

  it.each([
    [{ session: "past" }, "?session=past"],
    [{ period: "last_month" }, "?period=last_month"],
    [{ class: "c4" }, "?class=c4"],
    [{ class: "c4", section: "a" }, "?class=c4&section=a"],
    [
      { period: "custom", from: "2026-08-05", to: "2026-08-20" },
      "?period=custom&from=2026-08-05&to=2026-08-20",
    ],
  ])("survives a round trip for %j", (params, search) => {
    const { query } = view(params as Record<string, string>);
    expect(analyticsQueryToSearch(query, defaults)).toBe(search);
    const again = parseAnalyticsQuery(
      Object.fromEntries(new URLSearchParams(search)),
      defaults,
    );
    expect(again).toEqual(query);
  });
});

describe("what revenue is compared with", () => {
  const before = (p: AnalyticsQuery["period"], today = TODAY) => {
    const query = { ...view().query, period: p };
    return previousRange(
      query,
      resolveAnalyticsRange(query, sessions, today),
      today,
    );
  };

  it("sets a month in progress against the same days last month", () => {
    expect(before("this_month")).toEqual({
      range: { from: "2026-10-01", to: "2026-10-12" },
      label: "vs same days last month",
    });
  });

  it("copes with a shorter month", () => {
    expect(before("this_month", "2027-03-31").range).toEqual({
      from: "2027-02-01",
      to: "2027-02-28",
    });
  });

  it("sets a finished month against the whole month before", () => {
    expect(before("last_month").range).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("sets a session so far against the same dates last year", () => {
    expect(before("session")).toEqual({
      range: { from: "2025-04-01", to: "2025-11-12" },
      label: "vs same dates last year",
    });
  });

  it("sets custom dates against as many days just before", () => {
    const { previous, compareLabel } = view({
      period: "custom",
      from: "2026-08-11",
      to: "2026-08-20",
    });
    expect(previous).toEqual({ from: "2026-08-01", to: "2026-08-10" });
    expect(compareLabel).toBe("vs the 10 days before");
  });
});

describe("chart points", () => {
  it("goes day by day through a short period", () => {
    const { unit, buckets } = analyticsBuckets(
      { from: "2026-10-01", to: "2026-10-31" },
      TODAY,
    );
    expect(unit).toBe("day");
    expect(buckets).toHaveLength(31);
    expect(buckets[0]).toEqual({ key: "2026-10-01", label: "1 Oct" });
  });

  it("shows this month's days still to come, for bills due then", () => {
    const { buckets } = analyticsBuckets(
      { from: "2026-11-01", to: "2026-11-30" },
      TODAY,
    );
    expect(buckets).toHaveLength(30);
  });

  it("goes month by month and stops at this month", () => {
    const { unit, buckets } = analyticsBuckets(
      { from: "2026-04-01", to: "2027-03-31" },
      TODAY,
    );
    expect(unit).toBe("month");
    expect(buckets.map((b) => b.label)).toEqual([
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sept",
      "Oct",
      "Nov",
    ]);
    expect(buckets[0].key).toBe("2026-04");
  });

  it("names the year once months would repeat", () => {
    const { buckets } = analyticsBuckets(
      { from: "2025-01-01", to: "2026-10-31" },
      TODAY,
    );
    expect(buckets).toHaveLength(22);
    expect(buckets[0].label).toBe("Jan 25");
  });

  it("starts a custom period's months at its first month", () => {
    const { buckets } = analyticsBuckets(
      { from: "2026-03-15", to: "2026-08-20" },
      TODAY,
    );
    expect(buckets.map((b) => b.key)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });
});

describe("what's being shown, in words", () => {
  it("writes dates as briefly as it can", () => {
    expect(rangeLabel({ from: "2026-04-01", to: "2027-03-31" })).toBe(
      "1 Apr 2026 – 31 Mar 2027",
    );
    expect(rangeLabel({ from: "2026-04-01", to: "2026-09-30" })).toBe(
      "1 Apr – 30 Sept 2026",
    );
    expect(rangeLabel({ from: "2026-11-01", to: "2026-11-30" })).toBe(
      "1 – 30 Nov 2026",
    );
    expect(rangeLabel({ from: "2026-11-05", to: "2026-11-05" })).toBe(
      "5 Nov 2026",
    );
  });

  it("names the class and section", () => {
    expect(view().summary).toBe("1 Apr 2026 – 31 Mar 2027 · All classes");
    expect(view({ class: "c4", section: "a" }).summary).toBe(
      "1 Apr 2026 – 31 Mar 2027 · Class 4 · Section A",
    );
  });
});
