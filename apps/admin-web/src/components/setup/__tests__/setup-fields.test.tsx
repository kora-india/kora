// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { School } from "lucide-react";
import {
  ChoiceCard,
  ChoiceGroup,
  Chip,
  Field,
  InputGroup,
  SetupSection,
  fieldProps,
  inputCls,
} from "../setup-fields";

describe("Field", () => {
  it("labels its control and describes it with the hint", () => {
    render(
      <Field id="name" label="School name" hint="As on your letterhead">
        <input {...fieldProps("name", undefined, true)} className={inputCls} />
      </Field>,
    );
    const input = screen.getByLabelText("School name");
    expect(input).toHaveAccessibleDescription("As on your letterhead");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("replaces the hint with the error and marks the control invalid", () => {
    render(
      <Field id="name" label="School name" hint="Hint" error="Enter a name">
        <input {...fieldProps("name", "Enter a name", true)} />
      </Field>,
    );
    const input = screen.getByLabelText("School name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a name");
    expect(screen.queryByText("Hint")).not.toBeInTheDocument();
  });

  it("marks optional fields in the label", () => {
    render(
      <Field id="site" label="Website" optional>
        <input id="site" />
      </Field>,
    );
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });
});

describe("InputGroup", () => {
  it("shows a fixed suffix next to the input", () => {
    render(
      <Field id="distance" label="Distance">
        <InputGroup id="distance" suffix="km" defaultValue="12" />
      </Field>,
    );
    expect(screen.getByLabelText("Distance")).toHaveValue("12");
    expect(screen.getByText("km")).toBeInTheDocument();
  });
});

describe("choices", () => {
  it("draws radios as cards that the keyboard and mouse can pick", async () => {
    const user = userEvent.setup();
    render(
      <ChoiceGroup id="type" legend="Type of institution">
        <ChoiceCard
          name="type"
          value="School"
          label="School"
          icon={School}
          defaultChecked
        />
        <ChoiceCard
          name="type"
          value="College"
          label="College"
          detail="Degree courses"
        />
      </ChoiceGroup>,
    );
    expect(
      screen.getByRole("group", { name: "Type of institution" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "School" })).toBeChecked();

    await user.click(screen.getByText("College"));
    expect(screen.getByRole("radio", { name: /College/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "School" })).not.toBeChecked();
  });

  it("toggles chips as checkboxes with a spoken label", async () => {
    const user = userEvent.setup();
    render(<Chip label="Mon" srLabel="Monday" />);
    const chip = screen.getByRole("checkbox", { name: "Monday" });
    await user.click(chip);
    expect(chip).toBeChecked();
  });

  it("shows a group error and marks the group invalid", () => {
    render(
      <ChoiceGroup id="days" legend="Working days" error="Pick a day">
        <Chip label="Mon" />
      </ChoiceGroup>,
    );
    const group = screen.getByRole("group", { name: "Working days" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Pick a day");
  });
});

describe("SetupSection", () => {
  it("is a labelled region with its description", () => {
    render(
      <SetupSection title="Contact" description="The office's details.">
        <p>Body</p>
      </SetupSection>,
    );
    expect(screen.getByRole("region", { name: "Contact" })).toHaveTextContent(
      "The office's details.",
    );
  });
});
