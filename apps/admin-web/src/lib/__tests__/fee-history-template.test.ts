// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { Workbook } from "exceljs";
import {
  findHistoryColumns,
  toHistoryRows,
  type HistoryColumns,
} from "../fees/fee-history";
import {
  buildHistoryWorkbook,
  downloadHistoryTemplate,
  type HistoryTemplate,
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
