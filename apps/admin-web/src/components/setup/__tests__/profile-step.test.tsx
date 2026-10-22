// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileStep, SUBDOMAIN_TAKEN_MESSAGE } from "../steps/profile-step";
import { setupDefaults } from "../setup-model";
import type { SubdomainStatus } from "../use-subdomain-check";
import { NOW, jsonResponse, renderWithForm } from "./test-utils";

const renderStep = (
  status: SubdomainStatus = "idle",
  values = setupDefaults("", NOW),
) => renderWithForm(<ProfileStep subdomainStatus={status} />, values);

afterEach(() => vi.unstubAllGlobals());

describe("ProfileStep", () => {
  it("suggests a web address from the name until the address is edited", async () => {
    const user = userEvent.setup();
    const { form } = renderStep();
    const name = screen.getByLabelText("School name");
    const address = screen.getByLabelText("Web address");

    await user.type(name, "Delhi Public School");
    expect(address).toHaveValue("delhi-public-school");

    await user.clear(address);
    await user.type(address, "DPS Ranchi!");
    expect(address).toHaveValue("dps-ranchi");

    await user.type(name, ", Ranchi");
    expect(address).toHaveValue("dps-ranchi");
    expect(form().getValues("subdomain")).toBe("dps-ranchi");
  });

  it.each([
    ["checking", "Checking availability…"],
    ["available", "dps-ranchi.schoolos.com is available"],
    [
      "error",
      "We couldn't check this right now. We'll check again when you create the school.",
    ],
  ] as [SubdomainStatus, string][])(
    "describes the address while it is %s",
    (status, text) => {
      renderStep(status, {
        ...setupDefaults("", NOW),
        subdomain: "dps-ranchi",
      });
      const address = screen.getByLabelText("Web address");
      expect(address).toHaveAccessibleDescription(text);
      expect(address).not.toHaveAttribute("aria-invalid");
    },
  );

  it("marks a taken address as an error", () => {
    renderStep("taken", { ...setupDefaults("", NOW), subdomain: "dps" });
    const address = screen.getByLabelText("Web address");
    expect(address).toHaveAttribute("aria-invalid", "true");
    expect(address).toHaveAccessibleDescription(SUBDOMAIN_TAKEN_MESSAGE);
  });

  it("shows every profile error once the step is validated", async () => {
    const { form } = renderStep();
    await act(async () => {
      await form().trigger([
        "name",
        "subdomain",
        "expectedStudents",
        "expectedStaff",
      ]);
    });
    expect(screen.getByLabelText("School name")).toHaveAccessibleDescription(
      "Enter your school's name (at least 3 characters)",
    );
    expect(
      screen.getByLabelText("Number of students"),
    ).toHaveAccessibleDescription("Enter roughly how many students you have");
    expect(
      screen.getByLabelText("Number of staff"),
    ).toHaveAccessibleDescription("Enter roughly how many staff you have");
  });

  it("picks the type of institution", async () => {
    const user = userEvent.setup();
    const { form } = renderStep();
    expect(screen.getByRole("radio", { name: "School" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Preschool" }));
    expect(form().getValues("schoolType")).toBe("Preschool");
  });

  describe("logo", () => {
    const png = () => new File(["logo"], "logo.png", { type: "image/png" });

    it("uploads a logo, previews it and can remove it", async () => {
      const fetchMock = vi.fn(() =>
        jsonResponse({ url: "https://res.cloudinary.com/kora/logo.png" }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();
      const { form } = renderStep();

      await user.upload(screen.getByTestId("logo-input"), png());

      expect(await screen.findByAltText("School logo")).toHaveAttribute(
        "src",
        "https://res.cloudinary.com/kora/logo.png",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/upload",
        expect.objectContaining({ method: "POST" }),
      );
      expect(form().getValues("logoUrl")).toBe(
        "https://res.cloudinary.com/kora/logo.png",
      );
      expect(
        screen.getByRole("button", { name: "Replace" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove" }));
      expect(screen.queryByAltText("School logo")).not.toBeInTheDocument();
      expect(form().getValues("logoUrl")).toBe("");
    });

    it.each([
      [
        "a GIF",
        () => new File(["gif"], "logo.gif", { type: "image/gif" }),
        "Use a PNG, JPG or WebP image.",
      ],
      [
        "a file over 5 MB",
        () =>
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
            type: "image/png",
          }),
        "The logo can be up to 5 MB.",
      ],
    ])("refuses %s before uploading", async (_, file, message) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup({ applyAccept: false });
      renderStep();

      await user.upload(screen.getByTestId("logo-input"), file());

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("shows the server's reason when an upload fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          jsonResponse({ error: "Uploads are paused" }, { status: 503 }),
        ),
      );
      const user = userEvent.setup();
      renderStep();

      await user.upload(screen.getByTestId("logo-input"), png());

      await waitFor(() =>
        expect(screen.getByText("Uploads are paused")).toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: "Upload logo" })).toBeEnabled();
    });
  });
});
