// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupRail } from "../setup-rail";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const stepButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}`) });

describe("SetupRail", () => {
  it("marks the current step and the steps already done", () => {
    render(<SetupRail step={2} furthestStep={3} onStepSelect={vi.fn()} />);

    expect(
      screen.getByRole("navigation", { name: "Setup steps" }),
    ).toBeInTheDocument();
    expect(stepButton("Location")).toHaveAttribute("aria-current", "step");
    expect(stepButton("Location")).toHaveAccessibleName(/current step/);
    expect(stepButton("Profile")).toHaveAccessibleName(/done/);
    // Reached, so it can be revisited, but not yet completed.
    expect(stepButton("Academic")).toHaveAccessibleName(
      "Academic Board, session and classes",
    );
    expect(stepButton("Academic")).toBeEnabled();
  });

  it("lets people revisit steps they have reached, but not skip ahead", async () => {
    const user = userEvent.setup();
    const onStepSelect = vi.fn();
    render(<SetupRail step={2} furthestStep={3} onStepSelect={onStepSelect} />);

    expect(stepButton("Location")).toBeDisabled();
    expect(stepButton("Plan")).toBeDisabled();

    await user.click(stepButton("Profile"));
    await user.click(stepButton("Academic"));
    expect(onStepSelect.mock.calls).toEqual([[1], [3]]);
  });

  it("starts with only the first step reachable", () => {
    render(<SetupRail step={1} furthestStep={1} onStepSelect={vi.fn()} />);
    for (const label of ["Profile", "Location", "Academic", "Plan"]) {
      expect(stepButton(label)).toBeDisabled();
    }
  });
});
