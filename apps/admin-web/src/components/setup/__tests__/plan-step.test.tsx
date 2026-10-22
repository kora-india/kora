// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanStep } from "../steps/plan-step";
import type { PlanChoice, SavedPayment } from "../setup-model";
import { COMPLETE_SCHOOL, renderWithForm } from "./test-utils";

function renderStep({
  choice = "TRIAL",
  savedPayment = null,
  values = COMPLETE_SCHOOL,
}: {
  choice?: PlanChoice;
  savedPayment?: SavedPayment | null;
  values?: typeof COMPLETE_SCHOOL;
} = {}) {
  const onChoiceChange = vi.fn();
  const onEdit = vi.fn();
  renderWithForm(
    <PlanStep
      choice={choice}
      onChoiceChange={onChoiceChange}
      savedPayment={savedPayment}
      onEdit={onEdit}
    />,
    values,
  );
  return { onChoiceChange, onEdit };
}

const planCard = (name: RegExp) =>
  screen.getByRole("radio", { name }).closest("label") as HTMLElement;

describe("PlanStep", () => {
  it("summarises the school before the plan choice", () => {
    renderStep();
    const summary = screen.getByRole("region", { name: "Your school" });
    for (const text of [
      "Delhi Public School",
      "dps-ranchi.schoolos.com",
      "1,500 students · 80 staff",
      "01, Near Railway Station, Main Road, Ranchi, Jharkhand 834001",
      "+91 9876543210 · office@dps.in",
      "CBSE · CBSE 9-point",
      "2026–27",
      "3 classes · UKG to Grade 2",
      "Mon – Sat · Single shift",
    ]) {
      expect(within(summary).getByText(text)).toBeInTheDocument();
    }
  });

  it.each([
    ["Edit profile", 1],
    ["Edit location", 2],
    ["Edit academic", 3],
  ])("%s goes back to step %i", async (label, step) => {
    const user = userEvent.setup();
    const { onEdit } = renderStep();
    await user.click(screen.getByRole("button", { name: label }));
    expect(onEdit).toHaveBeenCalledWith(step);
  });

  it("starts with the free trial selected and lets a paid plan be chosen", async () => {
    const user = userEvent.setup();
    const { onChoiceChange } = renderStep();
    expect(
      screen.getByRole("radio", { name: "Free trial for 14 days" }),
    ).toBeChecked();

    await user.click(
      screen.getByRole("radio", { name: "Pro, ₹1,999 a month" }),
    );
    expect(onChoiceChange).toHaveBeenCalledWith("PRO");
  });

  it("shows the chosen plan as selected", () => {
    renderStep({ choice: "ENTERPRISE" });
    expect(screen.getByRole("radio", { name: /Enterprise/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Free trial/ })).not.toBeChecked();
  });

  it("flags the plan that fits the school and warns about ones that don't", () => {
    renderStep();
    expect(
      within(planCard(/^Pro/)).getByText("Fits your school"),
    ).toBeInTheDocument();
    expect(
      within(planCard(/^Basic/)).getByText(
        "Covers 500 students; you expect 1,500.",
      ),
    ).toBeInTheDocument();
    expect(
      within(planCard(/^Pro/)).queryByText(/you expect/),
    ).not.toBeInTheDocument();
  });

  it("marks the popular plan when the size is unknown", () => {
    renderStep({ values: { ...COMPLETE_SCHOOL, expectedStudents: undefined } });
    expect(within(planCard(/^Pro/)).getByText("Popular")).toBeInTheDocument();
    expect(screen.queryByText("Fits your school")).not.toBeInTheDocument();
  });

  it("warns when the school is bigger than the trial allows", () => {
    renderStep({ values: { ...COMPLETE_SCHOOL, expectedStudents: 2500 } });
    expect(
      within(planCard(/Free trial/)).getByText(
        "Covers 2,000 students; you expect 2,500.",
      ),
    ).toBeInTheDocument();
    expect(
      within(planCard(/^Enterprise/)).getByText("Fits your school"),
    ).toBeInTheDocument();
  });

  it("confirms a saved payment instead of offering plans again", () => {
    renderStep({
      savedPayment: {
        plan: "BASIC",
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig",
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "We received your payment",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your Basic plan is paid.",
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
