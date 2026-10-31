// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddStudentsPanel } from "../add-students-panel";

vi.mock("@/components/fees/import-history-dialog", () => ({
  ImportHistoryDialog: ({ open, withStudents }: any) =>
    open ? <div>History dialog {String(withStudents)}</div> : null,
}));
vi.mock("@/components/students/import-students-dialog", () => ({
  ImportStudentsDialog: ({ open }: any) =>
    open ? <div>Students dialog</div> : null,
}));

const setup = {
  session: { id: "s1", name: "2026-27" },
  studentCount: 0,
  firstMonth: "2026-04",
  currentMonth: "2026-10",
  lateFeeRule: "₹100 monthly",
  feeHeadCount: 6,
  imports: [],
};
const classes = [{ id: "c1", name: "Grade 1", sections: [] }];

const renderPanel = (over = {}) => {
  render(<AddStudentsPanel setup={{ ...setup, ...over }} classes={classes} />);
  return userEvent.setup();
};

describe("AddStudentsPanel", () => {
  beforeEach(() => localStorage.clear());

  it("shows what's set up so far", () => {
    renderPanel();
    expect(screen.getByText("2026-27 · 1 class")).toBeVisible();
    expect(screen.getByText("6 fee heads")).toBeVisible();
    expect(screen.getByText("₹100 monthly")).toBeVisible();
  });

  it("says when there's no late fee yet", () => {
    renderPanel({ lateFeeRule: null });
    expect(screen.getByText("Not set")).toBeVisible();
  });

  it("offers students only", async () => {
    const user = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /^Import students only/ }),
    );
    expect(screen.getByText("Students dialog")).toBeVisible();
  });

  it("offers students with their fee history", async () => {
    const user = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /^Import students with fee history/ }),
    );
    expect(screen.getByText("History dialog true")).toBeVisible();
  });

  it("stays away once skipped", async () => {
    const user = renderPanel();
    await user.click(screen.getByRole("button", { name: /^Skip for now/ }));
    expect(screen.queryByText("Add your students")).not.toBeInTheDocument();

    renderPanel();
    expect(screen.queryByText("Add your students")).not.toBeInTheDocument();
  });

  it("still works when the browser won't store anything", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const user = renderPanel();
    await user.click(screen.getByRole("button", { name: /^Skip for now/ }));
    expect(screen.queryByText("Add your students")).not.toBeInTheDocument();
    setItem.mockRestore();
  });
});
