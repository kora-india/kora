// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationStep } from "../steps/location-step";
import { STEPS } from "../setup-model";
import { jsonResponse, renderWithForm } from "./test-utils";

const RANCHI = [
  {
    Status: "Success",
    PostOffice: [{ District: "Ranchi", State: "Jharkhand", Country: "India" }],
  },
];

afterEach(() => vi.unstubAllGlobals());

describe("LocationStep", () => {
  it("fills in the city and state from the pincode", async () => {
    const fetchMock = vi.fn(() => jsonResponse(RANCHI));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithForm(<LocationStep />);

    await user.type(screen.getByLabelText("Pincode"), "834001");

    expect(
      await screen.findByText("Filled in Ranchi, Jharkhand"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.postalpincode.in/pincode/834001",
    );
    expect(screen.getByLabelText("City or district")).toHaveValue("Ranchi");
    expect(screen.getByLabelText("State")).toHaveValue("Jharkhand");
    expect(screen.getByLabelText("Country")).toHaveValue("India");
  });

  it("clears city and state errors once the pincode fills them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse(RANCHI)),
    );
    const user = userEvent.setup();
    const { form } = renderWithForm(<LocationStep />);
    await act(async () => {
      await form().trigger(["city", "state"]);
    });
    expect(screen.getByLabelText("City or district")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await user.type(screen.getByLabelText("Pincode"), "834001");

    await screen.findByText("Filled in Ranchi, Jharkhand");
    expect(screen.getByLabelText("City or district")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText("State")).not.toHaveAttribute("aria-invalid");
  });

  it.each([
    [
      "finds nothing",
      () => jsonResponse([{ Status: "Error", PostOffice: null }]),
    ],
    ["is unreachable", () => Promise.reject(new Error("offline"))],
  ])("asks for the city and state when the lookup %s", async (_, response) => {
    vi.stubGlobal("fetch", vi.fn(response));
    const user = userEvent.setup();
    renderWithForm(<LocationStep />);

    await user.type(screen.getByLabelText("Pincode"), "999999");

    expect(
      await screen.findByText(
        "We couldn't find this pincode. Enter the city and state yourself.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("City or district")).toHaveValue("");
  });

  it("accepts only digits in the pincode and phone", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithForm(<LocationStep />);

    await user.type(screen.getByLabelText("Pincode"), "83a4-0");
    expect(screen.getByLabelText("Pincode")).toHaveValue("8340");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Office phone"), "98765 43210");
    expect(screen.getByLabelText("Office phone")).toHaveValue("9876543210");
  });

  it("shows every location error once the step is validated", async () => {
    const { form } = renderWithForm(<LocationStep />);
    await act(async () => {
      await form().trigger(STEPS[1].fields);
    });
    expect(screen.getByLabelText("Street address")).toHaveAccessibleDescription(
      "Enter the full street address",
    );
    expect(screen.getByLabelText("Pincode")).toHaveAccessibleDescription(
      "Enter a 6-digit pincode",
    );
    expect(screen.getByLabelText("Office phone")).toHaveAccessibleDescription(
      "Enter a 10-digit number, or 11 with the STD code",
    );
    expect(screen.getByLabelText("Office email")).toHaveAccessibleDescription(
      "Enter a valid email address",
    );
  });
});
