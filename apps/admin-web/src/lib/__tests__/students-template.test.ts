// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { Workbook } from "exceljs";
import { STUDENT_TEMPLATE_HEADERS } from "../fees/fee-history";
import {
  PREFILLED_ROWS,
  VALIDATED_ROWS,
  buildStudentsWorkbook,
  studentsTemplateFileName,
  type StudentsTemplateOptions,
} from "../students-template";
import { readSpreadsheet } from "../read-spreadsheet";
import {
  guessColumnMapping,
  hasStudentDetails,
  normalizeImportRow,
} from "../student-import-helpers";

const classes = [
  { name: "Class 10", sections: ["A", "B"] },
  { name: "Class 2", sections: ["A"] },
  { name: "Nursery", sections: [] },
];

async function open(options: StudentsTemplateOptions = { classes }) {
  const book = new Workbook();
  await book.xlsx.load(
    await (await buildStudentsWorkbook(options)).xlsx.writeBuffer(),
  );
  return book;
}

const column = (sheet: ReturnType<Workbook["getWorksheet"]>, header: string) =>
  (sheet!.getRow(1).values as string[]).indexOf(header);

describe("students template", () => {
  it("has every column the import reads, each matched to its own field", async () => {
    const sheet = (await open()).worksheets[0];
    expect(sheet.name).toBe("Students");
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    expect(headers).toEqual(STUDENT_TEMPLATE_HEADERS);
    expect(headers).toContain("APAAR ID");
    expect(headers).toContain("PAN Number");
    const fields = Object.values(guessColumnMapping(headers));
    expect(fields).not.toContain(null);
    expect(new Set(fields).size).toBe(headers.length);
  });

  it("keeps IDs, phones and dates as text so Excel doesn't change them", async () => {
    const sheet = (await open()).getWorksheet("Students")!;
    for (const header of [
      "Admission Number",
      "Parent Phone",
      "Date of Birth",
      "APAAR ID",
      "PAN Number",
      "Pincode",
    ]) {
      expect(sheet.getColumn(column(sheet, header)).numFmt, header).toBe("@");
    }
  });

  it("offers the school's classes and sections in drop-downs", async () => {
    const book = await open();
    const sheet = book.getWorksheet("Students")!;
    const lists = book.getWorksheet("Lists")!;
    expect(lists.state).toBe("hidden");
    const listValues = (col: number) =>
      (lists.getColumn(col).values as unknown[]).slice(2).filter(Boolean);
    expect(listValues(1)).toEqual(["Class 10", "Class 2", "Nursery"]);
    expect(listValues(2)).toEqual(["A", "B"]);

    const classCell = sheet.getCell(2, column(sheet, "Class"));
    expect(classCell.dataValidation).toMatchObject({
      type: "list",
      formulae: ["Lists!$A$2:$A$4"],
      errorStyle: "warning",
    });
    const lastRow = sheet.getCell(VALIDATED_ROWS + 1, column(sheet, "Gender"));
    expect(lastRow.dataValidation).toMatchObject({ type: "list" });
    expect(
      sheet.getCell(2, column(sheet, "Blood Group")).dataValidation,
    ).toMatchObject({
      formulae: ["Lists!$D$2:$D$9"],
    });
  });

  it("explains how to fill it, with the school's classes", async () => {
    const lines = (await open())
      .getWorksheet("Instructions")!
      .getColumn(1)
      .values.filter(Boolean)
      .map(String);
    expect(lines.join("\n")).toContain("APAAR ID is 12 digits");
    expect(lines).toContain("Class 10: A, B");
    expect(lines).toContain("Nursery: no sections yet");
  });

  it("leaves Class and Section blank for the whole school", async () => {
    const sheet = (await open()).getWorksheet("Students")!;
    expect(sheet.getCell(2, column(sheet, "Class")).value).toBeNull();
    expect(studentsTemplateFileName({ classes })).toBe(
      "students-template.xlsx",
    );
  });

  it("fills one section's Class and Section down the sheet", async () => {
    const options = {
      classes,
      forSection: { className: "Class 10", section: "B" },
    };
    const sheet = (await open(options)).getWorksheet("Students")!;
    expect(sheet.getCell(2, column(sheet, "Class")).value).toBe("Class 10");
    expect(
      sheet.getCell(PREFILLED_ROWS + 1, column(sheet, "Section")).value,
    ).toBe("B");
    expect(
      sheet.getCell(PREFILLED_ROWS + 2, column(sheet, "Class")).value,
    ).toBeNull();
    expect(studentsTemplateFileName(options)).toBe("students-class-10-b.xlsx");
  });

  it("imports only the students typed into a section's template", async () => {
    const book = await buildStudentsWorkbook({
      classes,
      forSection: { className: "Class 10", section: "B" },
    });
    const sheet = book.getWorksheet("Students")!;
    const set = (row: number, header: string, value: string) =>
      (sheet.getCell(row, column(sheet, header)).value = value);
    set(2, "Student Name", "Asha Verma");
    set(2, "Parent Name", "Ravi Verma");
    set(2, "Parent Phone", "9876543210");
    set(2, "APAAR ID", "123456789012");
    set(2, "PAN Number", "ABCDE1234F");
    set(3, "Student Name", "Kabir Khan");
    set(3, "Parent Name", "Imran Khan");
    set(3, "Parent Phone", "9123456780");

    const { headers, rows } = await readSpreadsheet(
      new File([await book.xlsx.writeBuffer()], "students-class-10-b.xlsx"),
    );
    const mapping = guessColumnMapping(headers);
    const students = rows
      .map((r) => normalizeImportRow(r.cells, mapping))
      .filter(hasStudentDetails);
    expect(rows.length).toBeGreaterThanOrEqual(PREFILLED_ROWS);
    expect(students).toEqual([
      expect.objectContaining({
        name: "Asha Verma",
        class: "Class 10",
        section: "B",
        apaarId: "123456789012",
        panNumber: "ABCDE1234F",
      }),
      expect.objectContaining({
        name: "Kabir Khan",
        class: "Class 10",
        section: "B",
      }),
    ]);
  });
});
