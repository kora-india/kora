// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_PLANS } from "@/lib/plans";
import { SetupWizard } from "../setup-wizard";
import {
  draftKey,
  readDraft,
  readSavedPayment,
  savedPaymentKey,
  writeDraft,
  writeSavedPayment,
  type SavedPayment,
} from "../setup-model";
import { SUBDOMAIN_TAKEN_MESSAGE } from "../steps/profile-step";
import { COMPLETE_SCHOOL, jsonResponse } from "./test-utils";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  signOut: vi.fn(),
  openDashboard: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", email: "admin@dps.in", name: "Asha Rao" } },
    update: mocks.update,
  }),
  signOut: mocks.signOut,
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("../navigation", () => ({ openDashboard: mocks.openDashboard }));

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

/** Routes fetch by URL; anything not overridden gets a happy answer. */
function mockFetch(overrides: Record<string, Handler> = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) return handler(url, init);
    }
    if (url.includes("check-subdomain"))
      return jsonResponse({ available: true });
    if (url.includes("postalpincode")) {
      return jsonResponse([
        {
          Status: "Success",
          PostOffice: [
            { District: "Ranchi", State: "Jharkhand", Country: "India" },
          ],
        },
      ]);
    }
    if (url.includes("/api/school/create"))
      return jsonResponse({ schoolId: "school-1" });
    return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof mockFetch>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(path));

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, path: string) => {
  const call = callsTo(fetchMock, path).at(-1);
  return call ? JSON.parse(String(call[1]?.body)) : undefined;
};

const heading = () => screen.getByRole("heading", { level: 1 });
const continueButton = () => screen.getByRole("button", { name: "Continue" });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Starts on the plan step with a complete school, as after a reload. */
function resumeAtPlanStep() {
  writeDraft("user-1", { step: 4, values: COMPLETE_SCHOOL });
}

const PAYMENT: SavedPayment = {
  plan: "PRO",
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "sig_1",
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SetupWizard", () => {
  it("won't leave the profile step until it's valid, and focuses the first problem", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);
    expect(heading()).toHaveTextContent("Tell us about your school");
    expect(screen.getByText("1 of 4")).toBeInTheDocument();

    await user.click(continueButton());

    expect(heading()).toHaveTextContent("Tell us about your school");
    const name = screen.getByLabelText("School name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();
    expect(
      screen.getByLabelText("Number of students"),
    ).toHaveAccessibleDescription("Enter roughly how many students you have");
  });

  it("walks through every step and starts a free trial", async () => {
    const created = deferred<Response>();
    const fetchMock = mockFetch({
      "/api/school/create": () => created.promise,
    });
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);

    // Profile
    await user.type(
      screen.getByLabelText("School name"),
      "Delhi Public School",
    );
    await user.type(screen.getByLabelText("Number of students"), "1500");
    await user.type(screen.getByLabelText("Number of staff"), "80");
    expect(
      await screen.findByText("delhi-public-school.schoolos.com is available"),
    ).toBeInTheDocument();
    await user.click(continueButton());

    // Location
    expect(heading()).toHaveTextContent("Where is your school?");
    expect(heading()).toHaveFocus();
    expect(screen.getByLabelText("Office email")).toHaveValue("admin@dps.in");
    await user.type(
      screen.getByLabelText("Street address"),
      "01, Near Railway Station, Main Road",
    );
    await user.type(screen.getByLabelText("Pincode"), "834001");
    await screen.findByText("Filled in Ranchi, Jharkhand");
    await user.type(screen.getByLabelText("Office phone"), "9876543210");
    await user.click(continueButton());

    // Academic
    expect(heading()).toHaveTextContent("How does your school run?");
    await user.click(continueButton());
    expect(heading()).toHaveTextContent("How does your school run?");
    expect(
      screen.getByRole("group", { name: "Classes you teach" }),
    ).toHaveAccessibleDescription("Select at least one class");
    await user.click(
      screen.getByRole("button", { name: "Select all Primary classes" }),
    );
    await user.click(continueButton());

    // Plan
    expect(heading()).toHaveTextContent("Review and choose how to start");
    expect(
      within(screen.getByRole("region", { name: "Your school" })).getByText(
        "5 classes · Grade 1 to Grade 5",
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Start 14-day free trial" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Setting up Delhi Public School",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Creating 5 classes")).toBeInTheDocument();

    await act(async () =>
      created.resolve(await jsonResponse({ schoolId: "school-1" })),
    );

    await waitFor(() => expect(mocks.openDashboard).toHaveBeenCalled());
    expect(bodyOf(fetchMock, "/api/school/create")).toMatchObject({
      name: "Delhi Public School",
      subdomain: "delhi-public-school",
      plan: "PRO",
      trial: true,
      expectedStudents: "1500",
      city: "Ranchi",
      state: "Jharkhand",
      phone: "9876543210",
      email: "admin@dps.in",
      classes: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"],
      academicSession: expect.stringMatching(/^\d{4} - \d{4}$/),
    });
    expect(bodyOf(fetchMock, "/api/school/create")).not.toHaveProperty(
      "logoUrl",
    );
    expect(callsTo(fetchMock, "create-order")).toHaveLength(0);
    expect(mocks.update).toHaveBeenCalledWith({ schoolId: "school-1" });
    expect(localStorage.getItem(draftKey("user-1"))).toBeNull();
  });

  it("saves answers as they're typed and restores them after a reload", async () => {
    mockFetch();
    const user = userEvent.setup();
    const { unmount } = render(<SetupWizard plans={DEFAULT_PLANS} />);

    await user.type(screen.getByLabelText("School name"), "Greenfield Academy");
    await waitFor(() =>
      expect(readDraft("user-1")?.values.name).toBe("Greenfield Academy"),
    );
    unmount();

    render(<SetupWizard plans={DEFAULT_PLANS} />);
    await waitFor(() =>
      expect(screen.getByLabelText("School name")).toHaveValue(
        "Greenfield Academy",
      ),
    );
    expect(screen.getByLabelText("Web address")).toHaveValue(
      "greenfield-academy",
    );
  });

  it("resumes on the step it was left on", async () => {
    mockFetch();
    writeDraft("user-1", { step: 3, values: COMPLETE_SCHOOL });
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);

    await waitFor(() =>
      expect(heading()).toHaveTextContent("How does your school run?"),
    );
    expect(screen.getByRole("checkbox", { name: "UKG" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(heading()).toHaveTextContent("Where is your school?");
    expect(screen.getByLabelText("City or district")).toHaveValue("Ranchi");
  });

  it("edits from the summary and returns to the plan through the step list", async () => {
    mockFetch();
    resumeAtPlanStep();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);
    await waitFor(() => expect(heading()).toHaveTextContent("Review"));

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(heading()).toHaveTextContent("Tell us about your school");
    const name = screen.getByLabelText("School name");
    await user.clear(name);
    await user.type(name, "DPS Ranchi");

    await user.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(heading()).toHaveTextContent("Review");
    expect(screen.getByText("DPS Ranchi")).toBeInTheDocument();
  });

  it("stops at the first invalid step when jumping ahead", async () => {
    mockFetch();
    writeDraft("user-1", {
      step: 4,
      values: { ...COMPLETE_SCHOOL, phone: "" },
    });
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);
    await waitFor(() => expect(heading()).toHaveTextContent("Review"));

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.click(screen.getByRole("button", { name: /^Plan/ }));

    expect(heading()).toHaveTextContent("Where is your school?");
    expect(screen.getByLabelText("Office phone")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("won't continue with a taken web address", async () => {
    mockFetch({
      "check-subdomain": () => jsonResponse({ available: false }),
    });
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);
    await user.type(
      screen.getByLabelText("School name"),
      "Delhi Public School",
    );
    await user.type(screen.getByLabelText("Number of students"), "1500");
    await user.type(screen.getByLabelText("Number of staff"), "80");

    const address = screen.getByLabelText("Web address");
    await waitFor(() =>
      expect(address).toHaveAccessibleDescription(SUBDOMAIN_TAKEN_MESSAGE),
    );
    await user.click(continueButton());

    expect(heading()).toHaveTextContent("Tell us about your school");
    expect(address).toHaveFocus();
  });

  it("goes back to the web address when the server says it was taken", async () => {
    const fetchMock = mockFetch({
      "/api/school/create": () =>
        jsonResponse(
          {
            code: "SUBDOMAIN_TAKEN",
            error: "This subdomain is already taken.",
          },
          { status: 409 },
        ),
    });
    resumeAtPlanStep();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);
    await waitFor(() =>
      expect(callsTo(fetchMock, "check-subdomain")).toHaveLength(1),
    );

    await user.click(
      await screen.findByRole("button", { name: "Start 14-day free trial" }),
    );

    await waitFor(() =>
      expect(heading()).toHaveTextContent("Tell us about your school"),
    );
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "This subdomain is already taken.",
    );
    const address = screen.getByLabelText("Web address");
    expect(address).toHaveAccessibleDescription(SUBDOMAIN_TAKEN_MESSAGE);
    expect(address).toHaveFocus();
    expect(mocks.openDashboard).not.toHaveBeenCalled();
  });

  it("pays for a plan, keeps the payment, then creates the school", async () => {
    let paymentWhenCreating: SavedPayment | null = null;
    const fetchMock = mockFetch({
      "create-order": () =>
        jsonResponse({ orderId: "order_1", amount: 199900, currency: "INR" }),
      "/api/school/create": () => {
        paymentWhenCreating = readSavedPayment("user-1");
        return jsonResponse({ schoolId: "school-1" });
      },
    });
    const Razorpay = vi.fn(function (this: { open: () => void }, options: any) {
      this.open = () =>
        options.handler({
          razorpay_payment_id: "pay_1",
          razorpay_order_id: "order_1",
          razorpay_signature: "sig_1",
        });
    });
    vi.stubGlobal("Razorpay", Razorpay);
    resumeAtPlanStep();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);

    await user.click(
      await screen.findByRole("radio", { name: "Pro, ₹1,999 a month" }),
    );
    expect(
      screen.getByText(/Paid monthly through Razorpay/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Pay ₹1,999 & create school" }),
    );

    await waitFor(() => expect(mocks.openDashboard).toHaveBeenCalled());
    expect(bodyOf(fetchMock, "create-order")).toEqual({
      plan: "PRO",
      subdomain: "dps-ranchi",
    });
    expect(Razorpay).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 199900,
        currency: "INR",
        order_id: "order_1",
        description: "Pro plan",
        prefill: expect.objectContaining({ contact: "9876543210" }),
      }),
    );
    expect(paymentWhenCreating).toEqual(PAYMENT);
    expect(bodyOf(fetchMock, "/api/school/create")).toMatchObject(PAYMENT);
    expect(bodyOf(fetchMock, "/api/school/create")).not.toHaveProperty("trial");
    expect(localStorage.getItem(savedPaymentKey("user-1"))).toBeNull();
  });

  it("re-enables paying when the payment window is closed", async () => {
    mockFetch({
      "create-order": () =>
        jsonResponse({ orderId: "order_1", amount: 99900, currency: "INR" }),
    });
    vi.stubGlobal(
      "Razorpay",
      vi.fn(function (this: { open: () => void }, options: any) {
        this.open = () => options.modal.ondismiss();
      }),
    );
    resumeAtPlanStep();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);

    await user.click(
      await screen.findByRole("radio", { name: "Basic, ₹999 a month" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Pay ₹999 & create school" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Pay ₹999 & create school" }),
      ).toBeEnabled(),
    );
    expect(mocks.openDashboard).not.toHaveBeenCalled();
  });

  it("finishes with a saved payment instead of charging again", async () => {
    const fetchMock = mockFetch();
    writeSavedPayment("user-1", PAYMENT);
    resumeAtPlanStep();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);

    expect(
      await screen.findByText("We received your payment"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    await waitFor(() => expect(mocks.openDashboard).toHaveBeenCalled());
    expect(callsTo(fetchMock, "create-order")).toHaveLength(0);
    expect(bodyOf(fetchMock, "/api/school/create")).toMatchObject(PAYMENT);
  });

  it("offers a retry when the classes and session couldn't be added", async () => {
    const fetchMock = mockFetch({
      "/api/school/create": () =>
        jsonResponse({
          schoolId: "school-1",
          starterDataError: "We couldn't add your classes and session.",
        }),
      "/api/school/starter-data": () => jsonResponse({ ok: true }),
    });
    resumeAtPlanStep();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);

    await user.click(
      await screen.findByRole("button", { name: "Start 14-day free trial" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Your school is ready, almost",
    });
    expect(dialog).toHaveTextContent(
      "We couldn't add your classes and session.",
    );
    expect(mocks.openDashboard).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.openDashboard).toHaveBeenCalled());
    expect(bodyOf(fetchMock, "/api/school/starter-data")).toEqual({
      classes: COMPLETE_SCHOOL.classes,
      academicSession: COMPLETE_SCHOOL.academicSession,
    });
  });

  it("signs out from the header", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<SetupWizard plans={DEFAULT_PLANS} />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
