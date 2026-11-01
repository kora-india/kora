// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportAttendanceDialog } from "../import-attendance-dialog";

const mocks = vi.hoisted(() => ({
  getAttendanceImportSetup: vi.fn(),
  getAttendanceTemplate: vi.fn(),
  checkAttendanceImport: vi.fn(),
  importAttendance: vi.fn(),
  undoAttendanceImport: vi.fn(),
  downloadAttendanceTemplate: vi.fn(),
  readSpreadsheetSheets: vi.fn(),
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions/attendance-import", () => ({
  getAttendanceImportSetup: mocks.getAttendanceImportSetup,
  getAttendanceTemplate: mocks.getAttendanceTemplate,
  checkAttendanceImport: mocks.checkAttendanceImport,
  importAttendance: mocks.importAttendance,
  undoAttendanceImport: mocks.undoAttendanceImport,
}));
vi.mock("@/lib/attendance-template", () => ({
  downloadAttendanceTemplate: mocks.downloadAttendanceTemplate,
}));
vi.mock("@/lib/read-spreadsheet", () => ({
  readSpreadsheetSheets: mocks.readSpreadsheetSheets,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const setup = {
  classes: [
    {
      id: "c4",
      name: "Class 4",
      sections: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    },
    { id: "c5", name: "Class 5", sections: [{ id: "x", name: "X" }] },
  ],
  firstMonth: "2026-04",
  currentMonth: "2026-11",
  imports: [],
};

const past = {
  id: "import-1",
  className: "Class 4",
  sectionName: "A",
  fromMonth: "2026-04",
  toMonth: "2026-06",
  fileName: "a.xlsx",
  recordCount: 2400,
  createdByName: "Asha Admin",
  createdAt: "2026-10-01T05:00:00.000Z",
  undoneAt: null,
};

const totals = {
  students: 40,
  days: 182,
  records: 7280,
  present: 6540,
  absent: 610,
  late: 95,
  excused: 35,
  alreadyInKora: 0,
};

const filledSheet = {
  name: "Apr 2026",
  headers: ["Admission No", "Student Name", "Roll No", "1 Wed", "2 Thu"],
  rows: [
    {
      sheetRow: 2,
      cells: {
        "Admission No": "ADM-1",
        "Student Name": "Tanvi",
        "1 Wed": "P",
        "2 Thu": "A",
      },
    },
    {
      sheetRow: 3,
      cells: { "Admission No": "ADM-2", "Student Name": "Yash" },
    },
  ],
};

const upload = () =>
  new File(["x"], "class-4.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

function renderDialog() {
  render(<ImportAttendanceDialog open onOpenChange={vi.fn()} />);
  return userEvent.setup();
}

async function chooseSection(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText("Class"), "c4");
  await user.selectOptions(screen.getByLabelText("Section"), "a");
}

async function uploadFilled() {
  const user = renderDialog();
  await chooseSection(user);
  await user.upload(screen.getByLabelText("Filled attendance"), upload());
  return user;
}

describe("ImportAttendanceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAttendanceImportSetup.mockResolvedValue(setup);
    mocks.readSpreadsheetSheets.mockResolvedValue([filledSheet]);
    mocks.checkAttendanceImport.mockResolvedValue({
      success: true,
      problems: [],
      totals,
    });
    mocks.importAttendance.mockResolvedValue({
      success: true,
      id: "import-2",
      records: 7280,
      students: 40,
      days: 182,
      skipped: 0,
    });
  });

  it("starts on this session's months, with nothing chosen", async () => {
    renderDialog();
    expect(await screen.findByLabelText("From")).toHaveValue("2026-04");
    expect(screen.getByLabelText("To")).toHaveValue("2026-11");
    expect(
      screen.getByText("Download Template").closest("button"),
    ).toBeDisabled();
    expect(screen.getByText("Upload File").closest("button")).toBeDisabled();
  });

  it("says so when a login has no sections", async () => {
    mocks.getAttendanceImportSetup.mockResolvedValue({ ...setup, classes: [] });
    renderDialog();
    expect(await screen.findByText(/no class sections/)).toBeInTheDocument();
    expect(screen.queryByText("Download Template")).not.toBeInTheDocument();
  });

  it("offers the sections of the chosen class only", async () => {
    const user = renderDialog();
    const section = await screen.findByLabelText("Section");
    expect(section).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Class"), "c5");

    expect(section).toBeEnabled();
    expect(screen.getByRole("option", { name: "X" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "A" })).not.toBeInTheDocument();
  });

  it("clears the section when the class changes", async () => {
    const user = renderDialog();
    await chooseSection(user);
    await user.selectOptions(screen.getByLabelText("Class"), "c5");
    expect(screen.getByLabelText("Section")).toHaveValue("");
  });

  it("downloads the chosen section's template", async () => {
    const template = { className: "Class 4", students: [] };
    mocks.getAttendanceTemplate.mockResolvedValue(template);
    const user = renderDialog();
    await chooseSection(user);

    expect(screen.getByText(/one sheet for each of 8 months/)).toBeVisible();
    await user.click(screen.getByText("Download Template"));

    await waitFor(() =>
      expect(mocks.downloadAttendanceTemplate).toHaveBeenCalledWith(template),
    );
    expect(mocks.getAttendanceTemplate).toHaveBeenCalledWith({
      classId: "c4",
      sectionId: "a",
      from: "2026-04",
      to: "2026-11",
    });
  });

  it("says why a template can't be made", async () => {
    mocks.getAttendanceTemplate.mockResolvedValue({
      error: "This section has no students yet",
    });
    const user = renderDialog();
    await chooseSection(user);
    await user.click(screen.getByText("Download Template"));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "This section has no students yet",
      ),
    );
    expect(mocks.downloadAttendanceTemplate).not.toHaveBeenCalled();
  });

  it("checks a file first, then imports it", async () => {
    const user = await uploadFilled();

    const button = await screen.findByRole("button", {
      name: "Import 7,280 records",
    });
    expect(screen.getByText("6,540")).toBeInTheDocument();
    expect(mocks.importAttendance).not.toHaveBeenCalled();

    // Students with nothing filled aren't sent, and neither are names.
    const sent = mocks.checkAttendanceImport.mock.calls[0][0];
    expect(sent).toEqual({
      classId: "c4",
      sectionId: "a",
      rows: [
        {
          period: "2026-04",
          sheetRow: 2,
          admissionNumber: "ADM-1",
          marks: { "1": "P", "2": "A" },
        },
      ],
    });

    await user.click(button);

    expect(await screen.findByText("Attendance imported")).toBeInTheDocument();
    expect(mocks.importAttendance).toHaveBeenCalledWith({
      ...sent,
      fileName: "class-4.xlsx",
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("won't import a file with problems", async () => {
    mocks.checkAttendanceImport.mockResolvedValue({
      success: true,
      totals,
      problems: ['Apr 2026, row 5, day 3: "X" isn\'t P, A, L or E'],
    });
    await uploadFilled();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fix 1 problem and upload the file again");
    expect(alert).toHaveTextContent("Nothing has been saved");
    expect(alert).toHaveTextContent('"X" isn\'t P, A, L or E');
    expect(
      screen.getByRole("button", { name: "Import 7,280 records" }),
    ).toBeDisabled();
  });

  it("says what's already in Kora", async () => {
    mocks.checkAttendanceImport.mockResolvedValue({
      success: true,
      problems: [],
      totals: { ...totals, alreadyInKora: 12 },
    });
    await uploadFilled();

    expect(
      await screen.findByText(/12 records already are in Kora/),
    ).toBeVisible();
  });

  it("has nothing to import when it's all in Kora already", async () => {
    mocks.checkAttendanceImport.mockResolvedValue({
      success: true,
      problems: [],
      totals: { ...totals, records: 0, alreadyInKora: 7280 },
    });
    await uploadFilled();

    expect(
      await screen.findByRole("button", { name: "Import 0 records" }),
    ).toBeDisabled();
  });

  it("turns away a file that isn't the template", async () => {
    mocks.readSpreadsheetSheets.mockResolvedValue([
      { name: "Sheet1", headers: ["Name"], rows: [] },
    ]);
    await uploadFilled();

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining("This isn't the template"),
      ),
    );
    expect(mocks.checkAttendanceImport).not.toHaveBeenCalled();
  });

  it("turns away a template with nothing filled in", async () => {
    mocks.readSpreadsheetSheets.mockResolvedValue([
      { ...filledSheet, rows: [filledSheet.rows[1]] },
    ]);
    await uploadFilled();

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "This file has no attendance in it",
      ),
    );
  });

  it("says nothing was saved if the import fails", async () => {
    mocks.importAttendance.mockResolvedValue({ error: "Something broke" });
    const user = await uploadFilled();
    await user.click(
      await screen.findByRole("button", { name: "Import 7,280 records" }),
    );

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "Nothing was saved. Something broke",
      ),
    );
    expect(screen.queryByText("Attendance imported")).not.toBeInTheDocument();
  });

  describe("past imports", () => {
    const undoButton = {
      name: "Undo import for Class 4 A, Apr 2026 – Jun 2026",
    };

    it("lists them and undoes one after confirming", async () => {
      mocks.getAttendanceImportSetup
        .mockResolvedValueOnce({ ...setup, imports: [past] })
        .mockResolvedValue({
          ...setup,
          imports: [{ ...past, undoneAt: "2026-10-02T05:00:00.000Z" }],
        });
      mocks.undoAttendanceImport.mockResolvedValue({
        success: true,
        removed: 2400,
        kept: 0,
      });
      const user = renderDialog();

      expect(
        await screen.findByText("Class 4 A · Apr 2026 – Jun 2026"),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", undoButton));
      expect(mocks.undoAttendanceImport).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Undo Import" }));

      await waitFor(() =>
        expect(mocks.undoAttendanceImport).toHaveBeenCalledWith("import-1"),
      );
      expect(await screen.findByText("Undone")).toBeInTheDocument();
      expect(mocks.toast.success).toHaveBeenCalledWith("Import undone");
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("says when corrected days stayed", async () => {
      mocks.getAttendanceImportSetup.mockResolvedValue({
        ...setup,
        imports: [past],
      });
      mocks.undoAttendanceImport.mockResolvedValue({
        success: true,
        removed: 2395,
        kept: 5,
      });
      const user = renderDialog();

      await user.click(await screen.findByRole("button", undoButton));
      await user.click(screen.getByRole("button", { name: "Undo Import" }));

      await waitFor(() =>
        expect(mocks.toast.success).toHaveBeenCalledWith(
          "Import undone. 5 records changed since stayed.",
        ),
      );
    });

    it("says why one can't be undone", async () => {
      mocks.getAttendanceImportSetup.mockResolvedValue({
        ...setup,
        imports: [past],
      });
      mocks.undoAttendanceImport.mockResolvedValue({
        error: "That import was already undone",
      });
      const user = renderDialog();

      await user.click(await screen.findByRole("button", undoButton));
      await user.click(screen.getByRole("button", { name: "Undo Import" }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith(
          "That import was already undone",
        ),
      );
    });
  });
});
