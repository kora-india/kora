// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { Workbook } from "exceljs";
import { readAttendanceSheets } from "../attendance-import";
import {
  buildAttendanceWorkbook,
  downloadAttendanceTemplate,
  type AttendanceTemplate,
} from "../attendance-template";
import { readSpreadsheetSheets } from "../read-spreadsheet";

const template: AttendanceTemplate = {
  className: "Class 4",
  sectionName: "A",
  months: ["2026-04", "2026-05"],
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "2026-11-01",
  students: [
    { admissionNumber: "0042", name: "तन्वी शाह", rollNumber: "04" },
    { admissionNumber: "0043", name: "Yash Roy", rollNumber: "05" },
  ],
};

const reopen = async (t = template) => {
  const made = await buildAttendanceWorkbook(t);
  const book = new Workbook();
  await book.xlsx.load(await made.xlsx.writeBuffer());
  return book;
};

describe("the attendance template", () => {
  it("has a sheet for each month, then the instructions", async () => {
    const book = await reopen();
    expect(book.worksheets.map((s) => s.name)).toEqual([
      "Apr 2026",
      "May 2026",
      "Instructions",
    ]);
  });

  it("has the student columns, then a column for each day", async () => {
    const sheet = (await reopen()).getWorksheet("Apr 2026")!;
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    expect(headers.slice(0, 5)).toEqual([
      "Admission No",
      "Student Name",
      "Roll No",
      "1 Wed",
      "2 Thu",
    ]);
    expect(headers).toHaveLength(33);
    expect(headers.at(-1)).toBe("30 Thu");
  });

  it("stops at today in the current month", async () => {
    const sheet = (
      await reopen({ ...template, months: ["2026-11"] })
    ).getWorksheet("Nov 2026")!;
    expect((sheet.getRow(1).values as string[]).slice(1)).toHaveLength(4);
  });

  it("lists the students with the day cells empty", async () => {
    const sheet = (await reopen()).getWorksheet("Apr 2026")!;
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell("A2").value).toBe("0042");
    expect(sheet.getCell("B3").value).toBe("Yash Roy");
    expect(sheet.getCell("C2").value).toBe("04");
    expect(sheet.getCell("D2").value).toBeNull();
  });

  it("keeps the student in view while scrolling", async () => {
    const sheet = (await reopen()).getWorksheet("Apr 2026")!;
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      xSplit: 3,
      ySplit: 1,
    });
  });

  it("keeps numbers with leading zeros as text", async () => {
    const sheet = (await reopen()).getWorksheet("Apr 2026")!;
    expect(sheet.getColumn(1).numFmt).toBe("@");
    expect(sheet.getColumn(3).numFmt).toBe("@");
  });

  it("greys out the days the school doesn't work", async () => {
    const sheet = (await reopen()).getWorksheet("Apr 2026")!;
    const fill = (cell: string) =>
      (sheet.getCell(cell).fill as { fgColor?: { argb?: string } } | undefined)
        ?.fgColor?.argb;
    expect(fill("H1")).toBe(fill("H3")); // 5 Sun
    expect(fill("H3")).toBeDefined();
    expect(fill("I3")).toBeUndefined(); // 6 Mon
  });

  it("greys nothing for a school with no working days set", async () => {
    const sheet = (await reopen({ ...template, workingDays: [] })).getWorksheet(
      "Apr 2026",
    )!;
    expect(sheet.getCell("H3").fill).toBeUndefined();
  });

  it("reads back through the upload once it's filled in", async () => {
    const book = await buildAttendanceWorkbook(template);
    const april = book.getWorksheet("Apr 2026")!;
    april.getCell("D2").value = "P";
    april.getCell("E2").value = "a";
    april.getCell("D3").value = "L";
    book.getWorksheet("May 2026")!.getCell("E3").value = "E";

    const sheets = await readSpreadsheetSheets(
      new File([await book.xlsx.writeBuffer()], "filled.xlsx"),
    );
    const read = readAttendanceSheets(sheets);

    expect(read?.months).toEqual(["2026-04", "2026-05"]);
    expect(read?.rows.filter((r) => Object.keys(r.marks).length > 0)).toEqual([
      {
        period: "2026-04",
        sheetRow: 2,
        admissionNumber: "0042",
        marks: { "1": "P", "2": "a" },
      },
      {
        period: "2026-04",
        sheetRow: 3,
        admissionNumber: "0043",
        marks: { "1": "L" },
      },
      {
        period: "2026-05",
        sheetRow: 3,
        admissionNumber: "0043",
        marks: { "2": "E" },
      },
    ]);
  });

  it("names the download after the section", async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => "blob:template");
    URL.revokeObjectURL = vi.fn();

    await downloadAttendanceTemplate(template);

    expect(names).toEqual(["attendance-class-4-a.xlsx"]);
  });
});
