// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcademicStep } from "../steps/academic-step";
import { CLASSES } from "../setup-model";
import { NOW, renderWithForm } from "./test-utils";

const renderStep = () => renderWithForm(<AcademicStep now={NOW} />);
const classesGroup = () =>
  screen.getByRole("group", { name: "Classes you teach" });

describe("AcademicStep", () => {
  it("offers the current and next session, current first", () => {
    renderStep();
    expect(
      screen.getByRole("radio", { name: /2026–27 · current/ }),
    ).toBeChecked();
    expect(screen.getByRole("radio", { name: /2027–28/ })).not.toBeChecked();
    expect(screen.getByText("April 2027 to March 2028")).toBeInTheDocument();
  });

  it("picks a board and grading system", async () => {
    const user = userEvent.setup();
    const { form } = renderStep();
    expect(screen.getByRole("radio", { name: "CBSE" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "ICSE" }));
    await user.click(screen.getByRole("radio", { name: /Letter grades/ }));

    expect(form().getValues("board")).toBe("ICSE");
    expect(form().getValues("gradingSystem")).toBe("PERCENTAGE_LETTER");
  });

  it("selects and clears a whole group of classes", async () => {
    const user = userEvent.setup();
    const { form } = renderStep();

    await user.click(
      screen.getByRole("button", { name: "Select all Primary classes" }),
    );

    for (const grade of [1, 2, 3, 4, 5]) {
      expect(
        screen.getByRole("checkbox", { name: `Grade ${grade}` }),
      ).toBeChecked();
    }
    expect(screen.getByRole("checkbox", { name: "Grade 6" })).not.toBeChecked();
    expect(classesGroup()).toHaveAccessibleDescription(
      "5 classes · Grade 1 to Grade 5",
    );

    await user.click(
      screen.getByRole("button", { name: "Clear Primary classes" }),
    );
    expect(form().getValues("classes")).toEqual([]);
  });

  it("selects every class, and asks for one when all are cleared", async () => {
    const user = userEvent.setup();
    const { form } = renderStep();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(form().getValues("classes")).toEqual(CLASSES);
    expect(classesGroup()).toHaveAccessibleDescription(
      "16 classes · Nursery to Grade 13",
    );
    expect(screen.getByRole("button", { name: "Select all" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(classesGroup()).toHaveAttribute("aria-invalid", "true");
    expect(classesGroup()).toHaveAccessibleDescription(
      "Select at least one class",
    );
  });

  it("toggles single classes in catalogue order in the summary", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole("checkbox", { name: "Grade 8" }));
    await user.click(screen.getByRole("checkbox", { name: "LKG" }));

    expect(classesGroup()).toHaveAccessibleDescription(
      "2 classes · LKG to Grade 8",
    );
  });

  it("sets the working week and shift", async () => {
    const user = userEvent.setup();
    const { form } = renderStep();
    const days = screen.getByRole("group", { name: "Working days" });
    expect(days).toHaveAccessibleDescription("Mon – Sat");

    await user.click(within(days).getByRole("checkbox", { name: "Sunday" }));
    expect(days).toHaveAccessibleDescription("Mon – Sun");

    await user.click(screen.getByRole("radio", { name: /Multiple shifts/ }));
    expect(form().getValues("schoolShift")).toBe("MULTIPLE");
  });

  it("asks for a working day when none are left", async () => {
    const user = userEvent.setup();
    renderStep();
    const days = screen.getByRole("group", { name: "Working days" });

    for (const day of within(days).getAllByRole("checkbox")) {
      if ((day as HTMLInputElement).checked) await user.click(day);
    }

    expect(days).toHaveAccessibleDescription("Select at least one working day");
  });
});
