// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsFilterBar } from "../analytics-filter-bar";
import {
  defaultAnalyticsQuery,
  type AnalyticsQuery,
} from "@/lib/reports/analytics-query";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/analytics",
}));

const sessions = [
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
  {
    id: "c4",
    name: "Class 4",
    sections: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
  },
  { id: "c5", name: "Class 5", sections: [] },
];
const defaults = defaultAnalyticsQuery({ id: "now" });

function renderBar(over: Partial<AnalyticsQuery> = {}) {
  render(
    <AnalyticsFilterBar
      query={{ ...defaults, ...over }}
      defaults={defaults}
      sessions={sessions}
      classes={classes}
    />,
  );
  return userEvent.setup({ pointerEventsCheck: 0 });
}

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByTitle(option));
};

describe("AnalyticsFilterBar", () => {
  beforeAll(() => {
    // Things antd's dropdowns reach for that jsdom doesn't have.
    window.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
    window.matchMedia ??= (() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as any;
  });

  beforeEach(() => replace.mockClear());

  it("offers no reset on the opening view", () => {
    renderBar();
    expect(
      screen.queryByRole("button", { name: "Reset" }),
    ).not.toBeInTheDocument();
  });

  it("keeps sections closed until there's a class", () => {
    renderBar();
    expect(screen.getByLabelText("Section")).toBeDisabled();
  });

  it("opens sections for a class that has them", () => {
    renderBar({ classId: "c4" });
    expect(screen.getByLabelText("Section")).toBeEnabled();
  });

  it("changes the URL for a recent period", async () => {
    const user = renderBar();
    await choose(user, "Period", "Last 3 months");
    expect(replace).toHaveBeenCalledWith("/analytics?period=last_3_months", {
      scroll: false,
    });
  });

  it("changes the URL for an earlier session", async () => {
    const user = renderBar();
    await choose(user, "Period", "2025-26");
    expect(replace).toHaveBeenCalledWith("/analytics?session=past", {
      scroll: false,
    });
  });

  it("clears the section when the class changes", async () => {
    const user = renderBar({ classId: "c4", sectionId: "a" });
    await choose(user, "Class", "Class 5");
    expect(replace).toHaveBeenCalledWith("/analytics?class=c5", {
      scroll: false,
    });
  });

  it("keeps the class when the period changes", async () => {
    const user = renderBar({ classId: "c4", sectionId: "a" });
    await choose(user, "Period", "This month");
    expect(replace).toHaveBeenCalledWith(
      "/analytics?period=this_month&class=c4&section=a",
      { scroll: false },
    );
  });

  it("waits for dates before leaving the current view", async () => {
    const user = renderBar();
    await choose(user, "Period", "Custom dates");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText("Custom dates").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Reset" })).toBeVisible();
  });

  it("goes back to the opening view on reset", async () => {
    const user = renderBar({
      period: "last_month",
      sessionId: "",
      classId: "c4",
    });
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(replace).toHaveBeenCalledWith("/analytics", { scroll: false });
  });
});
