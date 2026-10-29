// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGlobalConfig } from "framer-motion";
import { utils, write } from "xlsx";
import { ImportStudentsDialog } from "../import-students-dialog";

const mocks = vi.hoisted(() => ({
  suggestImportMapping: vi.fn(),
  bulkImportStudents: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions/import-mapping", () => ({
  suggestImportMapping: mocks.suggestImportMapping,
}));
vi.mock("@/lib/actions/student-import", () => ({
  bulkImportStudents: mocks.bulkImportStudents,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const classes = [
  { id: "class-4", name: "Class 4", sections: [{ id: "sec-a", name: "A" }] },
];

/** A sheet whose name and parent columns the header rules can't read. */
const HINDI_SHEET = [
  "छात्र का नाम,Class,Section,F/N,Mobile,Religion",
  "Asha Verma,Class 4,A,Ravi Verma,9416940224,Hindu",
  "Kabir Khan,Class 4,A,Imran Khan,9158116441,Muslim",
].join("\n");

async function upload(contents: string | File) {
  const user = userEvent.setup();
  const { container } = render(
    <ImportStudentsDialog open onOpenChange={vi.fn()} classes={classes} />,
  );
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await user.upload(
    input,
    typeof contents === "string"
      ? new File([contents], "students.csv", { type: "text/csv" })
      : contents,
  );
  await screen.findByText(/Preview Data/);
  return user;
}

const fieldFor = (column: string) =>
  screen.getByLabelText(`Field for column "${column}"`) as HTMLSelectElement;

describe("ImportStudentsDialog column matching", () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bulkImportStudents.mockResolvedValue({
      imported: 2,
      skipped: 0,
      failed: 0,
      errors: [],
    });
  });

  it("fills the columns the rules missed with AI suggestions, marked as such", async () => {
    mocks.suggestImportMapping.mockResolvedValue({
      suggestions: {
        "छात्र का नाम": "name",
        "F/N": "fatherName",
        Religion: null,
      },
    });
    await upload(HINDI_SHEET);

    await waitFor(() => expect(fieldFor("छात्र का नाम")).toHaveValue("name"));
    expect(fieldFor("F/N")).toHaveValue("fatherName");
    expect(fieldFor("Religion")).toHaveValue("");
    // The rules' own matches stay.
    expect(fieldFor("Mobile")).toHaveValue("parentPhone");
    expect(fieldFor("Class")).toHaveValue("class");

    expect(screen.getAllByTitle("Suggested by AI")).toHaveLength(2);
    expect(screen.getByText(/AI matched 2 columns/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Asha Verma" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Ravi Verma" }),
    ).toBeInTheDocument();
  });

  it("asks only about unmatched columns, without sending anyone's details", async () => {
    mocks.suggestImportMapping.mockResolvedValue({ suggestions: {} });
    await upload(HINDI_SHEET);
    await waitFor(() => expect(mocks.suggestImportMapping).toHaveBeenCalled());

    const request = mocks.suggestImportMapping.mock.calls[0][0];
    expect(request.columns.map((c: { header: string }) => c.header)).toEqual([
      "छात्र का नाम",
      "F/N",
      "Religion",
    ]);
    expect(request.taken).toEqual(["class", "section", "parentPhone"]);
    const sent = JSON.stringify(request);
    for (const detail of [
      "Asha",
      "Kabir",
      "Ravi",
      "Imran",
      "9416940224",
      "9158116441",
    ]) {
      expect(sent).not.toContain(detail);
    }
  });

  it("doesn't ask when the rules matched every column", async () => {
    await upload(
      ["Full Name,Parent Name,Parent Phone", "Asha,Ravi,9416940224"].join("\n"),
    );

    expect(mocks.suggestImportMapping).not.toHaveBeenCalled();
    expect(fieldFor("Full Name")).toHaveValue("name");
  });

  it("without AI, the person matches columns by hand and imports", async () => {
    mocks.suggestImportMapping.mockResolvedValue({ available: false });
    const user = await upload(HINDI_SHEET);
    await waitFor(() => expect(mocks.suggestImportMapping).toHaveBeenCalled());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a column for student name, parent name",
    );
    const start = screen.getByRole("button", { name: "Start Import" });
    expect(start).toBeDisabled();

    await user.selectOptions(fieldFor("छात्र का नाम"), "Student name");
    await user.selectOptions(fieldFor("F/N"), "Father's name");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(start);

    await screen.findByText("Import Complete");
    const [rows] = mocks.bulkImportStudents.mock.calls[0];
    expect(rows).toEqual([
      expect.objectContaining({
        name: "Asha Verma",
        parentName: "Ravi Verma",
        parentPhone: "9416940224",
        classId: "class-4",
        sectionId: "sec-a",
        sheetRow: 2,
      }),
      expect.objectContaining({ name: "Kabir Khan", sheetRow: 3 }),
    ]);
    // Religion stayed "Don't import".
    expect(rows[0]).not.toHaveProperty("Religion");
  });

  it("says why when AI matching fails, and still lets the person match", async () => {
    mocks.suggestImportMapping.mockResolvedValue({
      error: "AI couldn't match the columns right now. Match them below.",
    });
    await upload(HINDI_SHEET);

    expect(
      await screen.findByText(
        "AI couldn't match the columns right now. Match them below.",
      ),
    ).toBeInTheDocument();
    expect(fieldFor("F/N")).not.toBeDisabled();
  });

  it("keeps Hindi names intact in a UTF-8 CSV, with or without a BOM", async () => {
    mocks.suggestImportMapping.mockResolvedValue({ available: false });
    // Excel's "CSV UTF-8" starts the file with a byte order mark.
    const user = await upload(
      "\uFEFF" +
        [
          "Full Name,Parent Name,Parent Phone,Class,Section",
          "आशा वर्मा,रवि वर्मा,9416940224,Class 4,A",
        ].join("\n"),
    );
    expect(fieldFor("Full Name")).toHaveValue("name");
    expect(screen.getByRole("cell", { name: "आशा वर्मा" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start Import" }));
    await screen.findByText("Import Complete");
    expect(mocks.bulkImportStudents.mock.calls[0][0][0]).toMatchObject({
      name: "आशा वर्मा",
      parentName: "रवि वर्मा",
    });
  });

  it("reads Excel files too", async () => {
    mocks.suggestImportMapping.mockResolvedValue({ available: false });
    const sheet = utils.aoa_to_sheet([
      ["Student Name", "Father's Name", "Mobile No.", "Class", "Section"],
      ["आशा वर्मा", "Ravi Verma", 9416940224, "Class 4", "A"],
    ]);
    const book = utils.book_new();
    utils.book_append_sheet(book, sheet, "Students");
    const bytes = write(book, { type: "array", bookType: "xlsx" });
    await upload(
      new File([bytes], "students.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    expect(fieldFor("Father's Name")).toHaveValue("fatherName");
    expect(fieldFor("Mobile No.")).toHaveValue("parentPhone");
    expect(screen.getByRole("cell", { name: "आशा वर्मा" })).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "9416940224" }),
    ).toBeInTheDocument();
  });

  it("never overrides a column the person changed while AI was working", async () => {
    let answer!: (value: unknown) => void;
    mocks.suggestImportMapping.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = await upload(HINDI_SHEET);
    await user.selectOptions(fieldFor("F/N"), "Mother's name");

    answer({ suggestions: { "छात्र का नाम": "name", "F/N": "fatherName" } });

    await waitFor(() => expect(fieldFor("छात्र का नाम")).toHaveValue("name"));
    expect(fieldFor("F/N")).toHaveValue("motherName");
    const fColumn = fieldFor("F/N").closest("div")!;
    expect(within(fColumn).queryByTitle("Suggested by AI")).toBeNull();
  });
});
