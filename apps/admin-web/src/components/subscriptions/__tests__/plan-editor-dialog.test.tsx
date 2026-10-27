// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_PLANS } from "@/lib/plans";
import { PlanEditorDialog } from "../plan-editor-dialog";

const mocks = vi.hoisted(() => ({
  updatePlan: vi.fn(),
  refresh: vi.fn(),
  onOpenChange: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions/plans", () => ({ updatePlan: mocks.updatePlan }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

function renderDialog(plan = DEFAULT_PLANS.BASIC) {
  render(
    <PlanEditorDialog
      plan={plan}
      schoolCount={3}
      open
      onOpenChange={mocks.onOpenChange}
    />,
  );
}

describe("PlanEditorDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updatePlan.mockResolvedValue({
      success: true,
      message: "Starter plan saved",
    });
  });

  it("starts from the plan as saved", () => {
    renderDialog();
    expect(screen.getByLabelText(/plan name/i)).toHaveValue("Basic");
    expect(screen.getByLabelText(/monthly price/i)).toHaveValue(999);
    expect(screen.getByLabelText("Students")).toHaveValue(500);
    expect(screen.getByLabelText("Benefit 1")).toHaveValue(
      "Up to 500 students",
    );
    expect(
      screen.getByRole("checkbox", { name: "Transport & bus fees" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Exams & report cards" }),
    ).not.toBeChecked();
    expect(screen.getByText(/right away for 3 schools/)).toBeInTheDocument();
  });

  it("saves the edited plan and refreshes the page", async () => {
    const user = userEvent.setup();
    renderDialog();

    const name = screen.getByLabelText(/plan name/i);
    await user.clear(name);
    await user.type(name, "Starter");
    const price = screen.getByLabelText(/monthly price/i);
    await user.clear(price);
    await user.type(price, "799");
    await user.click(
      screen.getByRole("checkbox", { name: "Exams & report cards" }),
    );
    // Students: unlimited
    await user.click(screen.getAllByRole("checkbox", { name: "Unlimited" })[0]);
    await user.click(screen.getByRole("button", { name: /add benefit/i }));
    await user.type(screen.getByLabelText("Benefit 7"), "Exams & report cards");
    await user.click(screen.getByRole("button", { name: /save plan/i }));

    expect(mocks.updatePlan).toHaveBeenCalledWith(
      "BASIC",
      expect.objectContaining({
        name: "Starter",
        monthlyPriceInr: 799,
        maxStudents: null,
        modules: ["TRANSPORT", "EXAMS"],
        features: [...DEFAULT_PLANS.BASIC.features, "Exams & report cards"],
      }),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Starter plan saved");
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows problems next to their fields without saving", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText(/plan name/i));
    await user.clear(screen.getByLabelText(/monthly price/i));
    await user.click(screen.getByRole("button", { name: /add benefit/i }));
    await user.click(screen.getByRole("button", { name: /save plan/i }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a number")).toBeInTheDocument();
    expect(screen.getByText("Benefit can't be empty")).toBeInTheDocument();
    expect(mocks.updatePlan).not.toHaveBeenCalled();
  });

  it("reorders and removes benefits", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Move benefit 2 up" }));
    await user.click(screen.getByRole("button", { name: "Remove benefit 3" }));
    await user.click(screen.getByRole("button", { name: /save plan/i }));

    const [first, second, , ...rest] = DEFAULT_PLANS.BASIC.features;
    expect(mocks.updatePlan.mock.calls[0][1].features).toEqual([
      second,
      first,
      ...rest,
    ]);
  });

  it("keeps the Free plan at ₹0 and off the popular badge", () => {
    renderDialog(DEFAULT_PLANS.FREE);
    expect(screen.getByLabelText(/monthly price/i)).toBeDisabled();
    expect(
      screen.queryByRole("checkbox", { name: /most popular/i }),
    ).not.toBeInTheDocument();
  });

  it("reports a server refusal", async () => {
    const user = userEvent.setup();
    mocks.updatePlan.mockResolvedValue({ error: "Unauthorized" });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /save plan/i }));

    expect(mocks.toast.error).toHaveBeenCalledWith("Unauthorized");
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
  });
});
