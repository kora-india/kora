// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportBalancesDialog } from "../import-balances-dialog";

const mocks = vi.hoisted(() => ({
  getOpeningBalanceSetup: vi.fn(),
  getOpeningBalanceTemplate: vi.fn(),
  checkOpeningBalances: vi.fn(),
  importOpeningBalances: vi.fn(),
  undoOpeningBalanceImport: vi.fn(),
  writeFile: vi.fn(),
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions/fee-import", () => ({
  getOpeningBalanceSetup: mocks.getOpeningBalanceSetup,
  getOpeningBalanceTemplate: mocks.getOpeningBalanceTemplate,
  checkOpeningBalances: mocks.checkOpeningBalances,
  importOpeningBalances: mocks.importOpeningBalances,
  undoOpeningBalanceImport: mocks.undoOpeningBalanceImport,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("xlsx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("xlsx")>()),
  writeFile: mocks.writeFile,
}));

const setup = {
  session: { id: "session-1", name: "2026-27" },
  studentCount: 3,
  today: "2026-10-31",
  feeHeads: [{ id: "annual", name: "Annual Fee", frequency: "YEARLY" }],
  imports: [],
};

const pastImport = {
  id: "import-1",
  asOfDate: "2026-09-30",
  fileName: "balances.xlsx",
  studentCount: 800,
  totalDues: 250000,
  totalAdvance: 12000,
  createdByName: "Asha Admin",
  createdAt: "2026-10-01T05:00:00.000Z",
  undoneAt: null,
};

const clean = {
  success: true,
  problems: [],
  alreadyImported: 0,
  withExistingBills: 0,
  students: 3,
  withDues: 1,
  withAdvance: 1,
  totalDues: 4500,
  totalAdvance: 1000,
};

const FILLED = [
  "Admission Number,Student Name,Class,Section,Roll Number,Parent Name,Dues (₹),Advance (₹)",
  "BCS-0001,Tanvi Shah,Class 1,B,43,Myra Prasad,4500,",
  "BCS-0002,Anika Mishra,Class 4,D,56,Neha Yadav,,1000",
  "BCS-0003,Yash Choudhary,Class 3,C,24,Kavya Malhotra,,",
].join("\n");

const csv = (contents: string) =>
  new File([contents], "balances.csv", { type: "text/csv" });

function renderDialog() {
  const user = userEvent.setup();
  render(<ImportBalancesDialog open onOpenChange={vi.fn()} />);
  return user;
}

async function uploadFile(contents = FILLED) {
  const user = renderDialog();
  await screen.findByText("Upload the filled file");
  await user.upload(screen.getByLabelText("Filled template"), csv(contents));
  return user;
}

describe("ImportBalancesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOpeningBalanceSetup.mockResolvedValue(setup);
    mocks.checkOpeningBalances.mockResolvedValue(clean);
    mocks.importOpeningBalances.mockResolvedValue({
      success: true,
      id: "import-2",
      students: 3,
      withDues: 1,
      withAdvance: 1,
      totalDues: 4500,
      totalAdvance: 1000,
    });
  });

  it("asks for a session first", async () => {
    mocks.getOpeningBalanceSetup.mockResolvedValue({ ...setup, session: null });
    renderDialog();

    expect(
      await screen.findByText(/Set a current academic session/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Download Template")).not.toBeInTheDocument();
  });

  it("asks for students first", async () => {
    mocks.getOpeningBalanceSetup.mockResolvedValue({
      ...setup,
      studentCount: 0,
    });
    renderDialog();

    expect(await screen.findByText(/Add your students/)).toBeInTheDocument();
  });

  it("downloads a template of the school's students", async () => {
    mocks.getOpeningBalanceTemplate.mockResolvedValue({
      students: [
        {
          admissionNumber: "0042",
          name: "Tanvi Shah",
          className: "Class 1",
          section: "B",
          rollNumber: "04",
          parentName: "Myra Prasad",
        },
      ],
    });
    const user = renderDialog();

    await user.click(await screen.findByText("Download Template"));

    await waitFor(() => expect(mocks.writeFile).toHaveBeenCalled());
    const [book, name] = mocks.writeFile.mock.calls[0];
    expect(name).toBe("opening-balances-template.xlsx");
    expect(book.SheetNames).toEqual(["Opening Balances", "Instructions"]);
    const sheet = book.Sheets["Opening Balances"];
    expect(sheet.A1.v).toBe("Admission Number");
    expect(sheet.G1.v).toBe("Dues (₹)");
    expect(sheet.H1.v).toBe("Advance (₹)");
    // Kept as typed, so Excel doesn't drop the leading zeros.
    expect(sheet.A2).toMatchObject({ v: "0042", t: "s", z: "@" });
    expect(sheet.E2).toMatchObject({ v: "04", t: "s", z: "@" });
    expect(sheet.B2.v).toBe("Tanvi Shah");
  });

  it("says which month billing starts from", async () => {
    const user = renderDialog();

    expect(await screen.findByText(/November 2026/)).toBeInTheDocument();

    const date = screen.getByLabelText("Balances are as of");
    await user.clear(date);
    await user.type(date, "2026-09-30");
    expect(screen.getByText(/from October 2026/)).toBeInTheDocument();
  });

  it("checks a filled file, then imports it with the ticked fee heads", async () => {
    const user = await uploadFile();

    expect(
      await screen.findByRole("button", { name: "Import 3 students" }),
    ).toBeEnabled();
    expect(screen.getByText("₹4,500")).toBeInTheDocument();
    expect(mocks.checkOpeningBalances).toHaveBeenCalledWith({
      asOfDate: "2026-10-31",
      rows: [
        {
          sheetRow: 2,
          admissionNumber: "BCS-0001",
          dues: "4500",
          advance: "",
        },
        {
          sheetRow: 3,
          admissionNumber: "BCS-0002",
          dues: "",
          advance: "1000",
        },
        { sheetRow: 4, admissionNumber: "BCS-0003", dues: "", advance: "" },
      ],
    });
    expect(mocks.importOpeningBalances).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /Annual Fee/ }));
    await user.click(screen.getByRole("button", { name: "Import 3 students" }));

    expect(await screen.findByText("Balances imported")).toBeInTheDocument();
    expect(mocks.importOpeningBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfDate: "2026-10-31",
        fileName: "balances.csv",
        chargedComponentIds: ["annual"],
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("sends only what the import reads, not names or classes", async () => {
    await uploadFile();
    await screen.findByRole("button", { name: "Import 3 students" });

    const sent = JSON.stringify(mocks.checkOpeningBalances.mock.calls[0][0]);
    expect(sent).not.toContain("Tanvi");
    expect(sent).not.toContain("Myra");
  });

  it("turns away a file that isn't the template", async () => {
    await uploadFile("Full Name,Phone\nTanvi,9000000000");

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining("no Admission Number, Dues, Advance column"),
      ),
    );
    expect(mocks.checkOpeningBalances).not.toHaveBeenCalled();
  });

  it("won't import a file with problems", async () => {
    mocks.checkOpeningBalances.mockResolvedValue({
      ...clean,
      problems: ['Row 5: Dues "abc" isn\'t a valid amount'],
    });
    await uploadFile();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fix 1 row and upload the file again");
    expect(alert).toHaveTextContent('Row 5: Dues "abc"');
    expect(alert).toHaveTextContent("Nothing has been saved");
    expect(
      screen.getByRole("button", { name: "Import 3 students" }),
    ).toBeDisabled();
  });

  it("explains students who are left out or already billed", async () => {
    mocks.checkOpeningBalances.mockResolvedValue({
      ...clean,
      alreadyImported: 2,
      withExistingBills: 1,
    });
    await uploadFile();

    expect(
      await screen.findByText(/2 students already have an opening balance/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 student already has bills in Kora/),
    ).toBeInTheDocument();
  });

  it("lists past imports and undoes one after confirming", async () => {
    mocks.getOpeningBalanceSetup
      .mockResolvedValueOnce({ ...setup, imports: [pastImport] })
      .mockResolvedValue({
        ...setup,
        imports: [{ ...pastImport, undoneAt: "2026-10-02T05:00:00.000Z" }],
      });
    mocks.undoOpeningBalanceImport.mockResolvedValue({ success: true });
    const user = renderDialog();

    await user.click(
      await screen.findByRole("button", {
        name: "Undo import as of 30 Sept 2026",
      }),
    );
    expect(mocks.undoOpeningBalanceImport).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Undo Import" }));

    await waitFor(() =>
      expect(mocks.undoOpeningBalanceImport).toHaveBeenCalledWith("import-1"),
    );
    expect(await screen.findByText("Undone")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("says why an import can't be undone", async () => {
    mocks.getOpeningBalanceSetup.mockResolvedValue({
      ...setup,
      imports: [pastImport],
    });
    mocks.undoOpeningBalanceImport.mockResolvedValue({
      error: "This import can't be undone: Tanvi already paid.",
    });
    const user = renderDialog();

    await user.click(
      await screen.findByRole("button", {
        name: "Undo import as of 30 Sept 2026",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Undo Import" }));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "This import can't be undone: Tanvi already paid.",
      ),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
