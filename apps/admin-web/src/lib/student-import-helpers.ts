/**
 * Pure helpers for the bulk student import (D5, D6).
 */

const ROMAN: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
};

/**
 * One key per class however a sheet writes it: "5", "Class 5", "Grade V",
 * "5th" and "STD 5" all become "5"; "Nursery" becomes "nursery".
 */
export function classMatchKey(name: string): string {
  let key = name.trim().toLowerCase().replace(/\s+/g, " ");
  key = key.replace(/^(class|grade|std\.?|standard)\s*/, "");
  key = key.replace(/^(\d+)(st|nd|rd|th)$/, "$1");
  if (ROMAN[key] !== undefined) return String(ROMAN[key]);
  return key;
}

/** Sort position on the class catalog's scale: Nursery -2, LKG -1, UKG 0, Grade N = N. */
export function displayOrderForClassName(name: string): number {
  const key = classMatchKey(name);
  if (/^\d+$/.test(key)) return Number(key);
  if (key === "nursery" || key === "pre-nursery" || key === "pre nursery")
    return -2;
  if (key === "lkg") return -1;
  if (key === "ukg") return 0;
  return 14; // the catalog's default order for "Other"
}

function utcDate(year: number, month: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject dates that roll over, like 31/02.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/**
 * Reads a date of birth from a spreadsheet cell. Accepts DD/MM/YYYY (also
 * with "-" or "."), YYYY-MM-DD, and Excel date serial numbers. Returns
 * `date: null` for an empty cell and an `error` for anything it can't read
 * unambiguously, so a bad date is reported instead of silently dropped or
 * misread as month-first.
 */
export function parseImportDate(raw: string | number | null | undefined): {
  date: Date | null;
  error?: string;
} {
  if (raw === null || raw === undefined) return { date: null };
  const value = String(raw).trim();
  if (value === "") return { date: null };

  let date: Date | null = null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (iso) {
    date = utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  } else if (dmy) {
    date = utcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  } else if (/^\d{4,5}(\.\d+)?$/.test(value)) {
    // Excel stores dates as days since 30 Dec 1899.
    const serial = Math.floor(Number(value));
    date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  }

  if (!date) {
    return {
      date: null,
      error: `"${value}" is not a valid date (use DD/MM/YYYY)`,
    };
  }
  const year = date.getUTCFullYear();
  if (year < 1950 || date.getTime() > Date.now()) {
    return { date: null, error: `"${value}" is not a plausible date of birth` };
  }
  return { date };
}

/** The student fields a spreadsheet column can fill. */
export type ImportField =
  | "name"
  | "firstName"
  | "lastName"
  | "class"
  | "section"
  | "rollNumber"
  | "admissionNumber"
  | "dateOfBirth"
  | "gender"
  | "bloodGroup"
  | "parentName"
  | "fatherName"
  | "motherName"
  | "parentPhone"
  | "studentPhone"
  | "parentEmail"
  | "studentEmail"
  | "address"
  | "city"
  | "state"
  | "pincode";

/**
 * Which field a column fills, read from its header the way a person would:
 * "Full Name", "Student's Name" and "Name of Student" are the student's name;
 * "Parent / Guardian Name" and "Father Name" a parent's; "Mobile No." a
 * phone. Contact columns are checked before name columns, so "Parent Phone"
 * isn't taken for a parent's name. null for a column the import doesn't use.
 */
export function importFieldForHeader(header: string): ImportField | null {
  const h = ` ${header
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  // "Father's" and "Parents" count as "father" and "parent".
  const has = (...words: string[]) =>
    words.some((w) => h.includes(` ${w} `) || h.includes(` ${w}s `));
  const student = has("student", "child", "pupil");

  if (has("phone", "mobile", "contact", "cell", "whatsapp", "tel", "telephone"))
    return student ? "studentPhone" : "parentPhone";
  if (has("email", "e mail", "mail"))
    return student ? "studentEmail" : "parentEmail";
  if (has("dob", "birth", "birthday")) return "dateOfBirth";
  if (has("roll")) return "rollNumber";
  if (
    has(
      "admission",
      "adm",
      "enrollment",
      "enrolment",
      "registration",
      "reg",
      "sr",
    )
  )
    return h.includes(" date ") ? null : "admissionNumber";
  if (has("gender", "sex")) return "gender";
  if (has("blood")) return "bloodGroup";
  if (has("pin", "pincode", "zip", "postal", "postcode")) return "pincode";
  if (has("city", "town")) return "city";
  if (has("state")) return "state";
  if (has("address")) return "address";
  if (has("section", "sec", "division", "div")) return "section";
  if (has("class", "grade", "standard", "std")) return "class";
  if (has("father", "dad")) return "fatherName";
  if (has("mother", "mom")) return "motherName";
  if (has("parent", "guardian")) return "parentName";
  if (has("first", "given")) return "firstName";
  if (has("last", "surname", "family")) return "lastName";
  if (has("name", "student", "full name")) return "name";
  return null;
}

/** What the import needs from every row; class and section can be picked for the whole file instead. */
export const REQUIRED_IMPORT_COLUMNS: {
  label: string;
  fields: ImportField[];
}[] = [
  { label: "Student name", fields: ["name", "firstName"] },
  { label: "Parent name", fields: ["parentName", "fatherName", "motherName"] },
  { label: "Parent phone", fields: ["parentPhone", "studentPhone"] },
];

/** The required columns a file's headers don't provide, by label. */
export function missingImportColumns(headers: string[]): string[] {
  const found = new Set(headers.map(importFieldForHeader));
  return REQUIRED_IMPORT_COLUMNS.filter(
    (c) => !c.fields.some((f) => found.has(f)),
  ).map((c) => c.label);
}

/** "M", "Boy" and "male" are MALE; anything unrecognised is left for the server to report. */
export function importGender(raw: string): string {
  const g = raw.trim().toLowerCase();
  if (["m", "male", "boy"].includes(g)) return "MALE";
  if (["f", "female", "girl"].includes(g)) return "FEMALE";
  if (["o", "other", "others", "transgender"].includes(g)) return "OTHER";
  return raw.trim().toUpperCase();
}

export type ImportRowValues = Partial<
  Record<
    | "name"
    | "class"
    | "section"
    | "rollNumber"
    | "admissionNumber"
    | "dateOfBirth"
    | "gender"
    | "bloodGroup"
    | "parentName"
    | "parentPhone"
    | "parentEmail"
    | "address"
    | "city"
    | "state"
    | "pincode",
    string
  >
>;

/**
 * One spreadsheet row as student fields. Cells are trimmed and empty ones
 * left out; when two columns fill one field the first filled one wins. The
 * student's name falls back to first + last name, the parent's name to the
 * father's, mother's or guardian's, and parent contact to the student's.
 */
export function normalizeImportRow(
  row: Record<string, unknown>,
): ImportRowValues {
  const cells: Partial<Record<ImportField, string>> = {};
  for (const [header, value] of Object.entries(row)) {
    const field = importFieldForHeader(header);
    const text =
      value === null || value === undefined ? "" : String(value).trim();
    if (field && text && !cells[field]) cells[field] = text;
  }
  const full = [cells.firstName, cells.lastName].filter(Boolean).join(" ");
  const values: ImportRowValues = {
    name: cells.name ?? (full || undefined),
    class: cells.class,
    section: cells.section,
    rollNumber: cells.rollNumber,
    admissionNumber: cells.admissionNumber,
    dateOfBirth: cells.dateOfBirth,
    gender: cells.gender ? importGender(cells.gender) : undefined,
    bloodGroup: cells.bloodGroup,
    parentName: cells.parentName ?? cells.fatherName ?? cells.motherName,
    parentPhone: cells.parentPhone ?? cells.studentPhone,
    parentEmail: cells.parentEmail ?? cells.studentEmail,
    address: cells.address,
    city: cells.city,
    state: cells.state,
    pincode: cells.pincode,
  };
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined),
  ) as ImportRowValues;
}

/** Roll numbers compared as a school would: "04" and "4" are the same roll. */
export function rollNumberKey(roll: string): string {
  const r = roll.trim().toLowerCase();
  return /^\d+$/.test(r) ? String(Number.parseInt(r, 10)) : r;
}
