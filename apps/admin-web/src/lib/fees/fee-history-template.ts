/**
 * The fee history template as a real Excel file. SheetJS can't freeze panes or
 * colour cells, so this one file uses ExcelJS, loaded only when a school
 * downloads the template, so no page carries it otherwise.
 */

import {
  HISTORY_MONTH_FIELDS,
  HISTORY_STUDENT_HEADERS,
  HISTORY_TEMPLATE_INSTRUCTIONS,
  STUDENT_HISTORY_INSTRUCTIONS,
  STUDENT_TEMPLATE_HEADERS,
  BLANK_MONTH_FIELDS,
  historyHeaders,
  studentHistoryHeaders,
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

/** A new school's blank template, with its own setup to fill it from. */
export interface StudentsHistoryTemplate {
  /** "YYYY-MM", oldest first. */
  months: string[];
  /** The school's fee heads, as columns. */
  heads: string[];
  /** The fee heads, classes and late fee, in words for the Instructions. */
  feeHeadNotes: string[];
  classNotes: string[];
  lateFeeRule: string | null;
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

/**
 * The blank template: students, then each month's fee heads. Only the student's
 * number and name stay in view, since a dozen frozen columns wouldn't fit.
 */
export async function buildStudentsHistoryWorkbook(
  template: StudentsHistoryTemplate,
) {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  const sheet = book.addWorksheet("Students and Fees", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  const headers = studentHistoryHeaders(template.months, template.heads);
  const perMonth = template.heads.length + BLANK_MONTH_FIELDS.length;
  sheet.columns = headers.map((header, index) => ({
    header,
    width: index === 1 ? 24 : Math.max(Math.ceil(header.length * 0.7), 12),
  }));
  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1);
    const month = Math.floor(
      (index - STUDENT_TEMPLATE_HEADERS.length) / perMonth,
    );
    if (month >= 0) column.fill = fillOf(MONTH_COLOURS[month % 2]);
    // The same text columns as the filled template, and numbers that Excel
    // would otherwise cut short.
    if (
      /^(Admission Number|Roll Number|Date of Birth|Parent Phone|Pincode)$| (Paid On|Receipt)$/.test(
        header,
      )
    ) {
      column.numFmt = "@";
    }
  });
  sheet.getRow(1).height = 32;
  sheet.getRow(1).eachCell((cell, column) => {
    if (column <= STUDENT_TEMPLATE_HEADERS.length) {
      cell.fill = fillOf(HEADER_COLOUR);
    }
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const instructions = book.addWorksheet("Instructions");
  instructions.getColumn(1).width = 110;
  instructions.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  instructions.addRows(STUDENT_HISTORY_INSTRUCTIONS.map((line) => [line]));
  instructions.getRow(1).font = { bold: true };
  const list = (title: string, lines: string[]) => {
    instructions.addRow([]);
    instructions.addRow([title]).font = { bold: true };
    instructions.addRows(lines.map((line) => [line]));
  };
  list("Your fee heads", template.feeHeadNotes);
  list("Your late fee", [template.lateFeeRule ?? "No late-fee rule set"]);
  list(
    "Your classes and sections. Any other name adds a new one.",
    template.classNotes,
  );

  return book;
}

async function saveWorkbook(
  book: Awaited<ReturnType<typeof buildHistoryWorkbook>>,
  fileName: string,
) {
  const data = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Builds the template and hands it to the browser as a download. */
export async function downloadHistoryTemplate(template: HistoryTemplate) {
  await saveWorkbook(
    await buildHistoryWorkbook(template),
    "fee-history-template.xlsx",
  );
}

/** Builds the blank template and hands it to the browser as a download. */
export async function downloadStudentsHistoryTemplate(
  template: StudentsHistoryTemplate,
) {
  await saveWorkbook(
    await buildStudentsHistoryWorkbook(template),
    "students-and-fee-history-template.xlsx",
  );
}
