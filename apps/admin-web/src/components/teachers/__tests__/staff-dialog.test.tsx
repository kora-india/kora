// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffDialog } from "../staff-dialog";

const mocks = vi.hoisted(() => ({
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  refresh: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/lib/actions/staff", () => ({
  createStaff: mocks.createStaff,
  updateStaff: mocks.updateStaff,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const LOGIN_BOX = { name: /Let them sign in to Kora/ };

function renderDialog(props: Partial<Parameters<typeof StaffDialog>[0]> = {}) {
  render(
    <StaffDialog open onOpenChange={vi.fn()} canManageLogins {...props} />,
  );
  return userEvent.setup();
}

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("e.g. Ramesh Kumar"), "Ravi");
  await user.type(screen.getByPlaceholderText("e.g. 9876543210"), "9000000000");
}

describe("StaffDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createStaff.mockResolvedValue({ success: true, id: "s1" });
    mocks.updateStaff.mockResolvedValue({ success: true, id: "s1" });
  });

  it("offers a login only for an accountant", async () => {
    const user = renderDialog();
    expect(screen.queryByRole("checkbox", LOGIN_BOX)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Driver" }));
    expect(screen.queryByRole("checkbox", LOGIN_BOX)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accountant" }));
    expect(screen.getByRole("checkbox", LOGIN_BOX)).toBeChecked();
  });

  it("doesn't offer it to someone who can't give logins", async () => {
    const user = renderDialog({ canManageLogins: false });
    await user.click(screen.getByRole("button", { name: "Accountant" }));
    expect(screen.queryByRole("checkbox", LOGIN_BOX)).not.toBeInTheDocument();
  });

  it("asks for an email before giving a login", async () => {
    const user = renderDialog();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Accountant" }));
    await user.click(screen.getByRole("button", { name: "Add Staff" }));

    expect(mocks.toast.error).toHaveBeenCalledWith(
      "Add their email so they can sign in",
    );
    expect(mocks.createStaff).not.toHaveBeenCalled();
  });

  it("shows the sign-in details once", async () => {
    mocks.createStaff.mockResolvedValue({
      success: true,
      id: "s1",
      login: { tempPassword: "Temp12345", emailed: true, reactivated: false },
    });
    const user = renderDialog();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Accountant" }));
    await user.type(screen.getByLabelText("Email"), "Ravi@School.com");
    await user.click(screen.getByRole("button", { name: "Add Staff" }));

    expect(await screen.findByText("Accountant added")).toBeInTheDocument();
    expect(screen.getAllByText("ravi@school.com").length).toBeGreaterThan(0);
    expect(mocks.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({ createLogin: true }),
    );
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByTestId("temp-password")).toHaveTextContent("Temp12345");
  });

  it("can add an accountant with no login", async () => {
    const onOpenChange = vi.fn();
    const user = renderDialog({ onOpenChange });
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Accountant" }));
    await user.click(screen.getByRole("checkbox", LOGIN_BOX));
    await user.click(screen.getByRole("button", { name: "Add Staff" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({ createLogin: false }),
    );
  });

  it("doesn't email someone just because their card was edited", async () => {
    const user = renderDialog({
      staff: {
        id: "s1",
        name: "Nikhil",
        phone: "8877592600",
        occupation: "Accountant",
        email: "nikhil@test.com",
      },
    });
    expect(screen.getByRole("checkbox", LOGIN_BOX)).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.updateStaff).toHaveBeenCalled());
    expect(mocks.updateStaff.mock.calls[0][1].createLogin).toBe(false);
  });

  it("locks the sign-in email and role of someone with a login", () => {
    renderDialog({
      staff: {
        id: "s1",
        name: "Neha",
        phone: "9000000000",
        occupation: "Accountant",
        email: "neha@test.com",
        userId: "u1",
      },
    });
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Occupation")).toBeDisabled();
    expect(screen.queryByRole("checkbox", LOGIN_BOX)).not.toBeInTheDocument();
    expect(screen.getByText(/Signs in to Kora with this email/)).toBeVisible();
  });

  it("shows an error from the server", async () => {
    mocks.createStaff.mockResolvedValue({
      error: "A user with this email already exists",
    });
    const user = renderDialog();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Accountant" }));
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.click(screen.getByRole("button", { name: "Add Staff" }));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "A user with this email already exists",
        expect.anything(),
      ),
    );
  });
});
