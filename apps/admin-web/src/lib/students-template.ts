/**
 * The blank students template for Bulk Import: one row per student, every
 * column the import reads, with drop-downs for class, section, gender and
 * blood group. Built in the browser with ExcelJS, loaded only when someone
 * downloads it.
 *
 * For one section, its Class and Section are already filled in down the
 * sheet, so a teacher only types the students; rows left otherwise empty are
 * ignored when the file is imported.
 */

import { STUDENT_TEMPLATE_HEADERS } from "@/lib/fees/fee-history";
import { fillOf, saveWorkbook } from "@/lib/fees/fee-history-template";

export interface StudentsTemplateClass {
  name: string;
  sections: string[];
}

export interface StudentsTemplateOptions {
  /** The school's classes and their sections, for the drop-downs. */
  classes: StudentsTemplateClass[];
  /** Fill Class and Section in for one section's list. */
  forSection?: { className: string; section: string };
}

/** Rows given Class and Section for one section's template. */
export const PREFILLED_ROWS = 60;
/** Rows that get the drop-downs. */
export const VALIDATED_ROWS = 500;

/** The columns every student needs. */
const REQUIRED = new Set([
  "Student Name",
  "Class",
  "Section",
  "Parent Name",
  "Parent Phone",
]);
/** Kept as text, so Excel doesn't drop leading zeros or reread dates. */
const TEXT = new Set([
  "Admission Number",
  "Roll Number",
  "Date of Birth",
  "Parent Phone",
  "Pincode",
  "APAAR ID",
  "PAN Number",
]);

const GENDERS = ["Male", "Female", "Other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const REQUIRED_COLOUR = "FFEDE9FE";
const HEADER_COLOUR = "FFF3F4F6";
const PREFILLED_COLOUR = "FFF9FAFB";

export const STUDENTS_TEMPLATE_INSTRUCTIONS = [
  "How to fill this file",
  "",
  "There is one row for each student.",
  "1. Student Name, Class, Section, Parent Name and Parent Phone are needed for every student (purple headings).",
  "2. Admission Number: leave it blank to use the school's next numbers, or type your own. Use each one once.",
  "3. Roll Number: leave it blank to number students in the order they're listed.",
  "4. Date of Birth is written as DD/MM/YYYY.",
  "5. Gender: Male, Female or Other. Blank means Male.",
  "6. APAAR ID is 12 digits. PAN Number looks like ABCDE1234F. Both can be left blank, and each belongs to one student.",
  "7. Class and Section: pick from the list. A class or section the school doesn't have yet is added when you import.",
  "8. Save the file and upload it in Students → Import.",
];

const headerColumn = (header: string) =>
  STUDENT_TEMPLATE_HEADERS.indexOf(header) + 1;

/** "students-template.xlsx", or "students-class-5-a.xlsx" for one section. */
export function studentsTemplateFileName(options: StudentsTemplateOptions) {
  if (!options.forSection) return "students-template.xlsx";
  const slug = `${options.forSection.className} ${options.forSection.section}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `students-${slug || "section"}.xlsx`;
}

export async function buildStudentsWorkbook(options: StudentsTemplateOptions) {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  const sheet = book.addWorksheet("Students", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });
  // Sheet order: Students, Instructions, then the hidden lists.
  const instructions = book.addWorksheet("Instructions");

  sheet.columns = STUDENT_TEMPLATE_HEADERS.map((header) => ({
    header,
    width:
      header === "Student Name" || header === "Parent Name"
        ? 24
        : header === "Address"
          ? 32
          : Math.max(header.length + 4, 12),
  }));
  STUDENT_TEMPLATE_HEADERS.forEach((header, index) => {
    if (TEXT.has(header)) sheet.getColumn(index + 1).numFmt = "@";
  });
  const head = sheet.getRow(1);
  head.height = 28;
  head.eachCell((cell) => {
    const header = String(cell.value);
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.fill = fillOf(REQUIRED.has(header) ? REQUIRED_COLOUR : HEADER_COLOUR);
    if (REQUIRED.has(header)) cell.note = "Needed for every student";
  });

  // Lists for the drop-downs, on a hidden sheet so long lists still work.
  const lists = book.addWorksheet("Lists", { state: "hidden" });
  const classNames = options.classes.map((c) => c.name);
  const sectionNames = [
    ...new Set(options.classes.flatMap((c) => c.sections)),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const fillList = (column: number, title: string, values: string[]) => {
    lists.getCell(1, column).value = title;
    values.forEach((v, i) => (lists.getCell(i + 2, column).value = v));
    const letter = String.fromCharCode(64 + column);
    return values.length
      ? `Lists!$${letter}$2:$${letter}$${values.length + 1}`
      : null;
  };
  const classRange = fillList(1, "Classes", classNames);
  const sectionRange = fillList(2, "Sections", sectionNames);
  const genderRange = fillList(3, "Gender", GENDERS);
  const bloodRange = fillList(4, "Blood Group", BLOOD_GROUPS);

  const dropDowns: { header: string; range: string | null; warn: string }[] = [
    {
      header: "Class",
      range: classRange,
      warn: "This class isn't set up yet. Importing will add it.",
    },
    {
      header: "Section",
      range: sectionRange,
      warn: "This section isn't set up yet. Importing will add it.",
    },
    {
      header: "Gender",
      range: genderRange,
      warn: "Use Male, Female or Other.",
    },
    {
      header: "Blood Group",
      range: bloodRange,
      warn: "Use a blood group from the list.",
    },
  ];
  for (const { header, range, warn } of dropDowns) {
    if (!range) continue;
    const column = headerColumn(header);
    for (let row = 2; row <= VALIDATED_ROWS + 1; row++) {
      sheet.getCell(row, column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [range],
        // A warning, not a refusal: new classes and sections are allowed.
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: header,
        error: warn,
      };
    }
  }

  if (options.forSection) {
    const classColumn = headerColumn("Class");
    const sectionColumn = headerColumn("Section");
    for (let row = 2; row <= PREFILLED_ROWS + 1; row++) {
      const classCell = sheet.getCell(row, classColumn);
      const sectionCell = sheet.getCell(row, sectionColumn);
      classCell.value = options.forSection.className;
      sectionCell.value = options.forSection.section;
      classCell.fill = fillOf(PREFILLED_COLOUR);
      sectionCell.fill = fillOf(PREFILLED_COLOUR);
    }
  }

  instructions.getColumn(1).width = 110;
  instructions.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  const lines = [...STUDENTS_TEMPLATE_INSTRUCTIONS];
  if (options.forSection) {
    lines.push(
      `9. This file is for ${options.forSection.className} ${options.forSection.section}: Class and Section are already filled in for ${PREFILLED_ROWS} rows. Rows with only those filled are skipped. For more students, copy them down.`,
    );
  }
  instructions.addRows(lines.map((line) => [line]));
  instructions.getRow(1).font = { bold: true };
  instructions.addRow([]);
  instructions.addRow(["Your classes and sections"]).font = { bold: true };
  instructions.addRows(
    options.classes.length
      ? options.classes.map((c) => [
          `${c.name}: ${c.sections.join(", ") || "no sections yet"}`,
        ])
      : [["No classes yet. The classes you type are added when you import."]],
  );

  return book;
}

/** Builds the template and hands it to the browser as a download. */
export async function downloadStudentsTemplate(
  options: StudentsTemplateOptions,
) {
  await saveWorkbook(
    await buildStudentsWorkbook(options),
    studentsTemplateFileName(options),
  );
}
