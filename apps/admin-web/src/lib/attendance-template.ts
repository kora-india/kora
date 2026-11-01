/**
 * The attendance template as an Excel file: a sheet per month, built with
 * ExcelJS like the fee history template, so it only loads on download.
 */

import {
  ATTENDANCE_STUDENT_HEADERS,
  ATTENDANCE_TEMPLATE_INSTRUCTIONS,
  attendanceDayHeader,
  attendanceSheetName,
  monthDates,
  weekdayOf,
} from "./attendance-import";
import { fillOf, saveWorkbook } from "./fees/fee-history-template";

export interface AttendanceTemplate {
  className: string;
  sectionName: string;
  /** "YYYY-MM", oldest first. */
  months: string[];
  /** The school's working days, such as "Mon". Empty means every day. */
  workingDays: string[];
  /** "YYYY-MM-DD", the school's date. */
  today: string;
  students: { admissionNumber: string; name: string; rollNumber: string }[];
}

const HEADER_COLOUR = "FFF3F4F6";
const CLOSED_COLOUR = "FFD9D9D9";
const WIDTHS = [16, 26, 9];

export async function buildAttendanceWorkbook(template: AttendanceTemplate) {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  const { months, students, today, workingDays } = template;

  for (const period of months) {
    const sheet = book.addWorksheet(attendanceSheetName(period), {
      views: [
        {
          state: "frozen",
          xSplit: ATTENDANCE_STUDENT_HEADERS.length,
          ySplit: 1,
        },
      ],
    });
    const dates = monthDates(period, today);
    const headers = [
      ...ATTENDANCE_STUDENT_HEADERS,
      ...dates.map(attendanceDayHeader),
    ];
    sheet.columns = headers.map((header, index) => ({
      header,
      width: WIDTHS[index] ?? 7,
    }));
    // Text, so Excel keeps "0042" and "04" as they're written.
    sheet.getColumn(1).numFmt = "@";
    sheet.getColumn(3).numFmt = "@";
    dates.forEach((date, index) => {
      if (workingDays.length > 0 && !workingDays.includes(weekdayOf(date))) {
        sheet.getColumn(ATTENDANCE_STUDENT_HEADERS.length + index + 1).fill =
          fillOf(CLOSED_COLOUR);
      }
    });

    for (const student of students) {
      sheet.addRow([student.admissionNumber, student.name, student.rollNumber]);
    }

    sheet.getRow(1).height = 32;
    sheet.getRow(1).eachCell((cell, column) => {
      if (column <= ATTENDANCE_STUDENT_HEADERS.length) {
        cell.fill = fillOf(HEADER_COLOUR);
      }
      cell.font = { bold: true };
      cell.alignment = {
        horizontal:
          column > ATTENDANCE_STUDENT_HEADERS.length ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
    });
  }

  const instructions = book.addWorksheet("Instructions");
  instructions.getColumn(1).width = 110;
  instructions.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  instructions.addRows(ATTENDANCE_TEMPLATE_INSTRUCTIONS.map((line) => [line]));
  instructions.getRow(1).font = { bold: true };
  return book;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Builds the template and hands it to the browser as a download. */
export async function downloadAttendanceTemplate(template: AttendanceTemplate) {
  await saveWorkbook(
    await buildAttendanceWorkbook(template),
    `attendance-${slug(`${template.className} ${template.sectionName}`)}.xlsx`,
  );
}
