// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { Workbook } from "exceljs";
import {
  findHistoryColumns,
  studentHistoryHeaders,
  toHistoryRows,
  toStudentRows,
  type HistoryColumns,
} from "../fees/fee-history";
import {
  buildHistoryWorkbook,
  buildStudentsHistoryWorkbook,
  downloadHistoryTemplate,
  downloadStudentsHistoryTemplate,
  type HistoryTemplate,
  type StudentsHistoryTemplate,
} from "../fees/fee-history-template";
import { readSpreadsheet } from "../read-spreadsheet";

const template: HistoryTemplate = {
  months: ["2026-04", "2026-05"],
  students: [
    {
      admissionNumber: "0042",
      name: "तन्वी शाह",
      className: "Class 1",
      section: "B",
      fees: [4000, 1000],
    },
    {
      admissionNumber: "0043",
      name: "Yash Roy",
      className: "Class 1",
      section: "B",
      fees: [null, 1000],
    },
  ],
};

const reopen = async () => {
  const data = await (await buildHistoryWorkbook(template)).xlsx.writeBuffer();
  const book = new Workbook();
  await book.xlsx.load(data);
  return book;
};

describe("fee history template workbook", () => {
  it("has the sheets schools fill in and read", async () => {
    const book = await reopen();
    expect(book.worksheets.map((s) => s.name)).toEqual([
      "Fee History",
      "Instructions",
    ]);
    expect(book.getWorksheet("Instructions")?.getCell("A1").value).toBe(
      "How to fill this file",
    );
  });

  it("freezes the header and the student columns", async () => {
    const sheet = (await reopen()).getWorksheet("Fee History")!;
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      xSplit: 4,
      ySplit: 1,
    });
  });

  it("colours each month's columns differently from the next", async () => {
    const sheet = (await reopen()).getWorksheet("Fee History")!;
    const colour = (cell: string) =>
      (sheet.getCell(cell).fill as { fgColor?: { argb?: string } }).fgColor
        ?.argb;
    expect(colour("E1")).toBe(colour("J2"));
    expect(colour("K1")).toBe(colour("P2"));
    expect(colour("E1")).not.toBe(colour("K1"));
  });

  it("keeps fees as numbers, and a student's blank month blank", async () => {
    const sheet = (await reopen()).getWorksheet("Fee History")!;
    expect(sheet.getCell("E2").value).toBe(4000);
    expect(sheet.getCell("K2").value).toBe(1000);
    expect(sheet.getCell("E3").value).toBeNull();
  });

  it("keeps what Excel would change as text", async () => {
    const sheet = (await reopen()).getWorksheet("Fee History")!;
    expect(sheet.getCell("A2").value).toBe("0042");
    for (const cell of ["A2", "H2", "J2", "N2", "P2"]) {
      expect(sheet.getCell(cell).numFmt, cell).toBe("@");
    }
    // The columns too, so rows the school adds stay as typed.
    expect(sheet.getColumn("H").numFmt).toBe("@");
    expect(sheet.getColumn("E").numFmt).toBeUndefined();
  });

  it("reads back through the upload, with nothing lost", async () => {
    const book = await buildHistoryWorkbook(template);
    const data = await book.xlsx.writeBuffer();
    const { headers, rows } = await readSpreadsheet(
      new File([data], "fee-history-template.xlsx"),
    );

    const columns = findHistoryColumns(headers) as HistoryColumns;
    expect(columns.months.map((m) => m.period)).toEqual(template.months);
    expect(rows.map((r) => r.sheetRow)).toEqual([2, 3]);
    expect(rows[0].cells["Student Name"]).toBe("तन्वी शाह");

    const months = rows.flatMap((r) =>
      toHistoryRows(r.cells, r.sheetRow, columns),
    );
    expect(
      months.map((m) => [m.admissionNumber, m.period, m.fees, m.sheetRow]),
    ).toEqual([
      ["0042", "2026-04", "4000", 2],
      ["0042", "2026-05", "1000", 2],
      ["0043", "2026-05", "1000", 3],
    ]);
  });

  it("downloads as an Excel file", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("fee-history-template.xlsx");
        expect(this.isConnected).toBe(true);
      });
    URL.createObjectURL = vi.fn(() => "blob:template");
    URL.revokeObjectURL = vi.fn();

    await downloadHistoryTemplate(template);

    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:template");
  });
});

describe("blank students and fee history template", () => {
  const blank: StudentsHistoryTemplate = {
    months: ["2026-04", "2026-05"],
    heads: ["Tuition Fee", "Transport Fee"],
    feeHeadNotes: ["Tuition Fee: ₹1,500 monthly"],
    classNotes: ["Grade 1: A, B"],
    lateFeeRule: "₹100 monthly",
  };

  const open = async (template = blank) => {
    const made = await buildStudentsHistoryWorkbook(template);
    const book = new Workbook();
    await book.xlsx.load(await made.xlsx.writeBuffer());
    return book;
  };

  it("is blank: headers, and nothing under them", async () => {
    const sheet = (await open()).getWorksheet("Students and Fees")!;
    expect(sheet.rowCount).toBe(1);
    expect((sheet.getRow(1).values as string[]).slice(1)).toEqual(
      studentHistoryHeaders(blank.months, blank.heads),
    );
  });

  it("keeps the student's number and name in view", async () => {
    const sheet = (await open()).getWorksheet("Students and Fees")!;
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      xSplit: 2,
      ySplit: 1,
    });
  });

  it("makes the columns Excel would change text, and leaves amounts alone", async () => {
    const sheet = (await open()).getWorksheet("Students and Fees")!;
    const format = (header: string) => {
      const index = (sheet.getRow(1).values as string[]).indexOf(header);
      return sheet.getColumn(index).numFmt;
    };
    for (const header of [
      "Admission Number",
      "Roll Number",
      "Date of Birth",
      "Parent Phone",
      "Pincode",
      "Apr 2026 Paid On",
      "May 2026 Receipt",
    ]) {
      expect(format(header), header).toBe("@");
    }
    expect(format("Apr 2026 Tuition Fee (₹)")).toBeUndefined();
    expect(format("Apr 2026 Paid (₹)")).toBeUndefined();
  });

  it("colours a month's columns as one group", async () => {
    const sheet = (await open()).getWorksheet("Students and Fees")!;
    const colour = (header: string) => {
      const index = (sheet.getRow(1).values as string[]).indexOf(header);
      const fill = sheet.getRow(1).getCell(index).fill as {
        fgColor?: { argb?: string };
      };
      return fill.fgColor?.argb;
    };
    expect(colour("Apr 2026 Tuition Fee (₹)")).toBe(colour("Apr 2026 Receipt"));
    expect(colour("Apr 2026 Receipt")).not.toBe(
      colour("May 2026 Tuition Fee (₹)"),
    );
  });

  it("lists the school's own setup in the instructions", async () => {
    const sheet = (await open()).getWorksheet("Instructions")!;
    const lines = sheet.getSheetValues().flat().filter(Boolean).join("\n");
    expect(lines).toContain("Tuition Fee: ₹1,500 monthly");
    expect(lines).toContain("₹100 monthly");
    expect(lines).toContain("Grade 1: A, B");
  });

  it("says when there's no late fee rule", async () => {
    const sheet = (await open({ ...blank, lateFeeRule: null })).getWorksheet(
      "Instructions",
    )!;
    expect(sheet.getSheetValues().flat()).toContain("No late-fee rule set");
  });

  it("reads back through the upload once it's filled in", async () => {
    const book = await buildStudentsHistoryWorkbook(blank);
    const sheet = book.getWorksheet("Students and Fees")!;
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    const filled: Record<string, string | number> = {
      "Admission Number": "0042",
      "Student Name": "तन्वी शाह",
      Class: "Grade 1",
      Section: "A",
      "Parent Name": "Myra Shah",
      "Parent Phone": "09000000000",
      "Apr 2026 Tuition Fee (₹)": 1500,
      "Apr 2026 Paid (₹)": 1500,
      "Apr 2026 Paid On": "05/04/2026",
    };
    sheet.addRow(headers.map((h) => filled[h] ?? null));

    const { headers: read, rows } = await readSpreadsheet(
      new File([await book.xlsx.writeBuffer()], "filled.xlsx"),
    );
    const columns = findHistoryColumns(read) as HistoryColumns;

    expect(toStudentRows(rows, columns)).toEqual([
      expect.objectContaining({
        admissionNumber: "0042",
        name: "तन्वी शाह",
        classId: "Grade 1",
        parentPhone: "09000000000",
      }),
    ]);
    expect(toHistoryRows(rows[0].cells, 2, columns)).toEqual([
      expect.objectContaining({
        period: "2026-04",
        heads: { "Tuition Fee": "1500" },
        paid: "1500",
        paidOn: "05/04/2026",
      }),
    ]);
  });

  it("downloads under its own name", async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => "blob:template");
    URL.revokeObjectURL = vi.fn();

    await downloadStudentsHistoryTemplate(blank);

    expect(names).toEqual(["students-and-fee-history-template.xlsx"]);
  });
});
