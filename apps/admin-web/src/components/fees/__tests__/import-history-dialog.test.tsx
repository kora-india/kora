// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportHistoryDialog } from "../import-history-dialog";

const mocks = vi.hoisted(() => ({
  getFeeHistorySetup: vi.fn(),
  getFeeHistoryTemplate: vi.fn(),
  checkFeeHistory: vi.fn(),
  startFeeHistoryImport: vi.fn(),
  importFeeHistoryBatch: vi.fn(),
  finishFeeHistoryImport: vi.fn(),
  undoFeeImport: vi.fn(),
  writeFile: vi.fn(),
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions/fee-history", () => ({
  getFeeHistorySetup: mocks.getFeeHistorySetup,
  getFeeHistoryTemplate: mocks.getFeeHistoryTemplate,
  checkFeeHistory: mocks.checkFeeHistory,
  startFeeHistoryImport: mocks.startFeeHistoryImport,
  importFeeHistoryBatch: mocks.importFeeHistoryBatch,
  finishFeeHistoryImport: mocks.finishFeeHistoryImport,
}));
vi.mock("@/lib/actions/fee-import", () => ({
  undoFeeImport: mocks.undoFeeImport,
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
  studentCount: 800,
  firstMonth: "2026-04",
  currentMonth: "2026-10",
  lateFeeRule: "₹100 monthly",
  imports: [],
};

const totals = {
  bills: 2,
  payments: 1,
  billed: 2150,
  lateFees: 150,
  discounts: 0,
  paid: 1000,
  dues: 1150,
  advance: 0,
  alreadyBilled: 0,
  inOpeningBalance: 0,
  undatedPayments: 0,
};

const clean = {
  success: true,
  problems: [],
  totals,
  newHeads: [],
  newSessions: [],
  heads: ["Tuition Fee"],
  periods: ["2026-04", "2026-05"],
};

const past = {
  id: "import-1",
  asOfDate: "2026-10-01",
  fileName: "history.xlsx",
  studentCount: 800,
  totalDues: 50000,
  totalAdvance: 0,
  createdByName: "Asha Admin",
  createdAt: "2026-10-01T05:00:00.000Z",
  undoneAt: null,
  billCount: 5600,
  totalBilled: 900000,
  totalPaid: 850000,
  totalLateFees: 12000,
  finished: true,
};

const HEADER =
  "Admission Number,Student Name,Class,Section,Month,Tuition Fee (₹),Late Fee (₹),Discount (₹),Paid (₹),Paid On,Mode,Receipt No,Reference";
const FILLED = [
  HEADER,
  "ADM-1,Tanvi Shah,Class 1,B,Apr 2026,1000,,,1000,05/04/2026,Cash,R-1,",
  "ADM-1,Tanvi Shah,Class 1,B,May 2026,1000,150,,,,,,",
  "ADM-2,Yash Roy,Class 1,B,Apr 2026,,,,,,,,",
].join("\n");

const csv = (contents: string) =>
  new File([contents], "history.csv", { type: "text/csv" });

function renderDialog() {
  const user = userEvent.setup();
  render(<ImportHistoryDialog open onOpenChange={vi.fn()} />);
  return user;
}

async function uploadFile(contents = FILLED) {
  const user = renderDialog();
  await screen.findByText("Upload the filled file");
  await user.upload(screen.getByLabelText("Filled fee history"), csv(contents));
  return user;
}

describe("ImportHistoryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFeeHistorySetup.mockResolvedValue(setup);
    mocks.checkFeeHistory.mockResolvedValue(clean);
    mocks.startFeeHistoryImport.mockResolvedValue({
      success: true,
      id: "import-2",
    });
    mocks.importFeeHistoryBatch.mockResolvedValue({ success: true });
    mocks.finishFeeHistoryImport.mockResolvedValue({
      success: true,
      students: 1,
      bills: 2,
      billed: 2150,
      paid: 1000,
      dues: 1150,
      lateFees: 150,
      advance: 0,
    });
  });

  it("asks for a session and students first", async () => {
    mocks.getFeeHistorySetup.mockResolvedValue({ ...setup, session: null });
    renderDialog();
    expect(
      await screen.findByText(/Set a current academic session/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Download Template")).not.toBeInTheDocument();
  });

  it("starts on this session's months and counts the rows", async () => {
    renderDialog();

    expect(await screen.findByLabelText("From")).toHaveValue("2026-04");
    expect(screen.getByLabelText("To")).toHaveValue("2026-10");
    expect(screen.getByText(/800 students for each of 7 months/)).toBeVisible();
  });

  it("downloads a template with amounts as numbers and months as text", async () => {
    mocks.getFeeHistoryTemplate.mockResolvedValue({
      headers: HEADER.split(","),
      rows: [
        [
          "0042",
          "Tanvi Shah",
          "Class 1",
          "B",
          "Apr 2026",
          "1000",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
      ],
    });
    const user = renderDialog();

    await user.click(await screen.findByText("Download Template"));

    await waitFor(() => expect(mocks.writeFile).toHaveBeenCalled());
    expect(mocks.getFeeHistoryTemplate).toHaveBeenCalledWith({
      from: "2026-04",
      to: "2026-10",
    });
    const [book, name] = mocks.writeFile.mock.calls[0];
    expect(name).toBe("fee-history-template.xlsx");
    expect(book.SheetNames).toEqual(["Fee History", "Instructions"]);
    const sheet = book.Sheets["Fee History"];
    expect(sheet.A2).toMatchObject({ v: "0042", t: "s", z: "@" });
    expect(sheet.E2).toMatchObject({ v: "Apr 2026", t: "s", z: "@" });
    expect(sheet.F2).toMatchObject({ v: 1000, t: "n" });
  });

  it("says when there's nothing left to fill in", async () => {
    mocks.getFeeHistoryTemplate.mockResolvedValue({ headers: [], rows: [] });
    const user = renderDialog();

    await user.click(await screen.findByText("Download Template"));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "Every student already has bills for these months",
      ),
    );
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("offers the late-fee choices when the school has a rule", async () => {
    renderDialog();

    expect(
      await screen.findByRole("checkbox", {
        name: /Work out blank late fees from our rule \(₹100 monthly\)/,
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Keep adding late fees/ }),
    ).not.toBeChecked();
  });

  it("keeps to the file when the school has no rule", async () => {
    mocks.getFeeHistorySetup.mockResolvedValue({
      ...setup,
      lateFeeRule: null,
    });
    renderDialog();

    expect(await screen.findByText(/no late-fee rule set/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("checks a file, then imports it with the chosen late-fee handling", async () => {
    const user = renderDialog();
    await user.click(
      await screen.findByRole("checkbox", { name: /Work out blank late/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Keep adding late fees/ }),
    );
    await user.upload(screen.getByLabelText("Filled fee history"), csv(FILLED));

    const importButton = await screen.findByRole("button", {
      name: "Import 2 bills",
    });
    expect(screen.getByText("₹2,150")).toBeInTheDocument();
    expect(screen.getByText("₹150")).toBeInTheDocument();
    expect(mocks.startFeeHistoryImport).not.toHaveBeenCalled();

    const sent = mocks.checkFeeHistory.mock.calls[0][0];
    expect(sent.calculateLateFees).toBe(true);
    // The blank row isn't sent, and neither are names.
    expect(sent.rows).toHaveLength(2);
    expect(sent.rows[0]).toMatchObject({
      sheetRow: 2,
      admissionNumber: "ADM-1",
      month: "Apr 2026",
      heads: { "Tuition Fee": "1000" },
      paid: "1000",
      mode: "Cash",
      receiptNo: "R-1",
    });
    expect(sent.rows[1]).toMatchObject({ sheetRow: 3, lateFee: "150" });
    expect(JSON.stringify(sent)).not.toContain("Tanvi");

    await user.click(importButton);

    expect(await screen.findByText("Fee history imported")).toBeInTheDocument();
    expect(mocks.startFeeHistoryImport).toHaveBeenCalledWith({
      fileName: "history.csv",
      calculateLateFees: true,
      continueLateFees: true,
      periods: ["2026-04", "2026-05"],
      heads: ["Tuition Fee"],
    });
    expect(mocks.importFeeHistoryBatch).toHaveBeenCalledWith({
      importId: "import-2",
      rows: sent.rows,
    });
    expect(mocks.finishFeeHistoryImport).toHaveBeenCalledWith("import-2");
    expect(mocks.undoFeeImport).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("sends a big file in batches and adds up their totals", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) =>
      [
        `ADM-${i}`,
        "Name",
        "Class 1",
        "A",
        "Apr 2026",
        "1000",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].join(","),
    );
    await uploadFile([HEADER, ...rows].join("\n"));

    expect(
      await screen.findByRole("button", { name: "Import 4 bills" }),
    ).toBeInTheDocument();
    expect(mocks.checkFeeHistory).toHaveBeenCalledTimes(2);
    expect(mocks.checkFeeHistory.mock.calls[0][0].rows).toHaveLength(1000);
    expect(mocks.checkFeeHistory.mock.calls[1][0].rows).toHaveLength(500);
    expect(screen.getByText("₹4,300")).toBeInTheDocument();
  });

  it("takes everything back if a batch fails", async () => {
    mocks.importFeeHistoryBatch.mockResolvedValue({
      error: "Some of these months were added just now.",
    });
    mocks.undoFeeImport.mockResolvedValue({ success: true });
    const user = await uploadFile();

    await user.click(
      await screen.findByRole("button", { name: "Import 2 bills" }),
    );

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "Nothing was saved. Some of these months were added just now.",
      ),
    );
    expect(mocks.undoFeeImport).toHaveBeenCalledWith("import-2");
    expect(mocks.finishFeeHistoryImport).not.toHaveBeenCalled();
    expect(screen.queryByText("Fee history imported")).not.toBeInTheDocument();
  });

  it("turns away a file that isn't the template", async () => {
    await uploadFile("Full Name,Phone\nTanvi,9000000000");

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining("no Admission Number, Month, Paid column"),
      ),
    );
    expect(mocks.checkFeeHistory).not.toHaveBeenCalled();
  });

  it("turns away a file with nothing in it", async () => {
    await uploadFile(
      [HEADER, "ADM-1,Tanvi,Class 1,B,Apr 2026,,,,,,,,"].join("\n"),
    );

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "This file has no fee amounts or payments in it",
      ),
    );
  });

  it("won't import a file with problems, listing them in row order", async () => {
    mocks.checkFeeHistory.mockResolvedValue({
      ...clean,
      problems: [
        'Row 12: Mode "Barter" isn\'t one we know',
        "Row 3: Asha has April 2026 twice with fee amounts.",
      ],
    });
    await uploadFile();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fix 2 rows and upload the file again");
    expect(alert).toHaveTextContent("Nothing has been saved");
    const items = alert.querySelectorAll("li");
    expect(items[0]).toHaveTextContent("Row 3:");
    expect(items[1]).toHaveTextContent("Row 12:");
    expect(
      screen.getByRole("button", { name: "Import 2 bills" }),
    ).toBeDisabled();
  });

  it("catches a receipt used for two students across the file", async () => {
    await uploadFile(
      [
        HEADER,
        "ADM-1,A,Class 1,B,Apr 2026,1000,,,1000,05/04/2026,Cash,R-1,",
        "ADM-2,B,Class 1,B,Apr 2026,1000,,,1000,05/04/2026,Cash,R-1,",
      ].join("\n"),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Row 3: Receipt R-1 is also used for another student",
    );
  });

  it("explains what will be left out or added", async () => {
    mocks.checkFeeHistory.mockResolvedValue({
      ...clean,
      totals: {
        ...totals,
        alreadyBilled: 3,
        inOpeningBalance: 1,
        undatedPayments: 2,
      },
      newHeads: ["Old Library"],
      newSessions: ["2025-26"],
    });
    await uploadFile();

    expect(await screen.findByText(/3 months already have/)).toBeVisible();
    expect(screen.getByText(/1 month is inside an opening/)).toBeVisible();
    expect(screen.getByText(/2 payments have no Paid On/)).toBeVisible();
    expect(screen.getByText(/Old Library/)).toBeVisible();
    expect(
      screen.getByText(/Past sessions will be added: 2025-26/),
    ).toBeVisible();
  });

  it("lists past imports and undoes one after confirming", async () => {
    mocks.getFeeHistorySetup
      .mockResolvedValueOnce({ ...setup, imports: [past] })
      .mockResolvedValue({
        ...setup,
        imports: [{ ...past, undoneAt: "2026-10-02T05:00:00.000Z" }],
      });
    mocks.undoFeeImport.mockResolvedValue({ success: true });
    const user = renderDialog();

    expect(await screen.findByText("5,600 bills")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Undo import of/ }));
    expect(mocks.undoFeeImport).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Undo Import" }));

    await waitFor(() =>
      expect(mocks.undoFeeImport).toHaveBeenCalledWith("import-1"),
    );
    expect(await screen.findByText("Undone")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows an upload that stopped part-way, so it can be cleared", async () => {
    mocks.getFeeHistorySetup.mockResolvedValue({
      ...setup,
      imports: [{ ...past, finished: false }],
    });
    renderDialog();

    expect(await screen.findByText("Didn't finish")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Undo import of/ }),
    ).toBeEnabled();
  });
});
