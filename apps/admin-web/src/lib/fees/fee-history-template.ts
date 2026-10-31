/**
 * The fee history template as a real Excel file. SheetJS can't freeze panes or
 * colour cells, so this one file uses ExcelJS, loaded only when a school
 * downloads the template, so no page carries it otherwise.
 */

import {
  HISTORY_MONTH_FIELDS,
  HISTORY_STUDENT_HEADERS,
  HISTORY_TEMPLATE_INSTRUCTIONS,
  historyHeaders,
} from "./fee-history";

export interface HistoryTemplateStudent {
  admissionNumber: string;
  name: string;
  className: string;
  section: string;
  /** One for each of the template's months; null leaves the cell blank. */
  fees: (number | null)[];
}

export interface HistoryTemplate {
  /** "YYYY-MM", oldest first. */
  months: string[];
  students: HistoryTemplateStudent[];
}

/** Months take turns in these, so a month's columns read as one group. */
const MONTH_COLOURS = ["FFEDE9FE", "FFE0F2FE"];
const HEADER_COLOUR = "FFF3F4F6";

const fillOf = (argb: string) => ({
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb },
});

export async function buildHistoryWorkbook(template: HistoryTemplate) {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  const sheet = book.addWorksheet("Fee History", {
    views: [
      {
        state: "frozen",
        xSplit: HISTORY_STUDENT_HEADERS.length,
        ySplit: 1,
      },
    ],
  });

  const headers = historyHeaders(template.months);
  const perMonth = HISTORY_MONTH_FIELDS.length;
  const firstMonthColumn = HISTORY_STUDENT_HEADERS.length + 1;
  const monthOf = (column: number) =>
    Math.floor((column - firstMonthColumn) / perMonth);

  sheet.columns = headers.map((header, index) => ({
    header,
    width: index === 1 ? 24 : Math.max(Math.ceil(header.length * 0.7), 12),
  }));
  // Text columns: Excel keeps "0042" and reads 05/06/2026 as written, whatever
  // date order the computer it's filled on uses.
  sheet.getColumn(1).numFmt = "@";
  template.months.forEach((_, month) => {
    const start = firstMonthColumn + month * perMonth;
    sheet.getColumn(start + HISTORY_MONTH_FIELDS.indexOf("Paid On")).numFmt =
      "@";
    sheet.getColumn(start + HISTORY_MONTH_FIELDS.indexOf("Receipt")).numFmt =
      "@";
  });

  for (const student of template.students) {
    sheet.addRow([
      student.admissionNumber,
      student.name,
      student.className,
      student.section,
      ...student.fees.flatMap((fees) => [
        fees,
        ...Array<null>(perMonth - 1).fill(null),
      ]),
    ]);
  }

  const paint = (row: number, bold: boolean) => {
    for (let column = 1; column <= headers.length; column++) {
      const cell = sheet.getRow(row).getCell(column);
      if (column >= firstMonthColumn) {
        cell.fill = fillOf(MONTH_COLOURS[monthOf(column) % 2]);
      } else if (bold) {
        cell.fill = fillOf(HEADER_COLOUR);
      }
      if (bold) {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", wrapText: true };
      }
    }
  };
  paint(1, true);
  sheet.getRow(1).height = 32;
  template.students.forEach((_, index) => paint(index + 2, false));

  const instructions = book.addWorksheet("Instructions");
  instructions.getColumn(1).width = 110;
  instructions.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  instructions.addRows(HISTORY_TEMPLATE_INSTRUCTIONS.map((line) => [line]));
  instructions.getRow(1).font = { bold: true };

  return book;
}

/** Builds the template and hands it to the browser as a download. */
export async function downloadHistoryTemplate(template: HistoryTemplate) {
  const book = await buildHistoryWorkbook(template);
  const data = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "fee-history-template.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
