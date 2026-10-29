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

/** What each field is called in the column dropdowns (and told to Gemini). */
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Student name",
  firstName: "First name",
  lastName: "Last name",
  class: "Class",
  section: "Section",
  rollNumber: "Roll number",
  admissionNumber: "Admission number",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  bloodGroup: "Blood group",
  parentName: "Parent name",
  fatherName: "Father's name",
  motherName: "Mother's name",
  parentPhone: "Parent phone",
  studentPhone: "Student phone",
  parentEmail: "Parent email",
  studentEmail: "Student email",
  address: "Address",
  city: "City",
  state: "State",
  pincode: "Pincode",
};

export const IMPORT_FIELDS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[];

export const isImportField = (v: unknown): v is ImportField =>
  typeof v === "string" && Object.hasOwn(IMPORT_FIELD_LABELS, v);

/** The field each column fills, by header; null leaves the column out. */
export type ColumnMapping = Record<string, ImportField | null>;

/** The mapping the header rules give a file. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  return Object.fromEntries(headers.map((h) => [h, importFieldForHeader(h)]));
}

/**
 * Fills in suggestions (from Gemini) for columns the rules left out. A
 * column the rules placed, or one the person has set (`keep`), stays as it
 * is. Returns the new mapping and the columns that took a suggestion.
 */
export function applySuggestions(
  mapping: ColumnMapping,
  suggestions: ColumnMapping,
  keep: ReadonlySet<string> = new Set(),
): { mapping: ColumnMapping; suggested: string[] } {
  const next = { ...mapping };
  const suggested: string[] = [];
  for (const [header, field] of Object.entries(suggestions)) {
    if (!(header in next) || next[header] || keep.has(header) || !field) {
      continue;
    }
    next[header] = field;
    suggested.push(header);
  }
  return { mapping: next, suggested };
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

/** The required fields no column is matched to, by label. */
export function missingImportColumns(mapping: ColumnMapping): string[] {
  const found = new Set(Object.values(mapping));
  return REQUIRED_IMPORT_COLUMNS.filter(
    (c) => !c.fields.some((f) => found.has(f)),
  ).map((c) => c.label);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DMY = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;
const ISO = /^\d{4}-\d{1,2}-\d{1,2}$/;

/**
 * Describes a column's values without repeating any of them, so the column
 * can be shown to Gemini without sharing a student's details: "10-digit
 * numbers", "dates like DD/MM/YYYY", "text of about 2 words". Only a short
 * list of values that repeat across many rows (gender, section, class) is
 * named, since those can't point to a person.
 */
export function describeColumn(values: unknown[]): string {
  const cells = values
    .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .filter(Boolean);
  if (cells.length === 0) return "always empty";

  const most = (test: (v: string) => boolean) =>
    cells.filter(test).length >= cells.length * 0.8;
  const filled = cells.length < values.length * 0.5 ? ", often empty" : "";
  const digits = (v: string) => v.replace(/[\s+()-]/g, "");

  if (most((v) => EMAIL.test(v))) return `email addresses${filled}`;
  if (most((v) => DMY.test(v))) return `dates like DD/MM/YYYY${filled}`;
  if (most((v) => ISO.test(v))) return `dates like YYYY-MM-DD${filled}`;
  if (most((v) => /^\d{10,13}$/.test(digits(v)))) {
    return `phone-like numbers of ${digits(cells[0]).length} digits${filled}`;
  }
  if (most((v) => /^\d{6}$/.test(v))) return `6-digit numbers${filled}`;

  const distinct = new Set(cells.map((v) => v.toLowerCase()));
  if (
    distinct.size <= 12 &&
    cells.length >= distinct.size * 3 &&
    [...distinct].every((v) => v.length <= 24)
  ) {
    const shown = [...new Set(cells)].slice(0, 12).join(", ");
    return `repeating values: ${shown}${filled}`;
  }
  if (most((v) => /^\d{1,5}$/.test(v))) return `small whole numbers${filled}`;
  if (most((v) => /\d/.test(v) && /^[A-Za-z0-9/._-]+$/.test(v))) {
    // The shape of a code, not the code: "BCS-2026-0001" is "AAA-0000-0000".
    const shape = cells[0].replace(/[A-Za-z]/g, "A").replace(/\d/g, "0");
    return `codes shaped like ${shape}${filled}`;
  }
  const words = Math.round(
    cells.reduce((n, v) => n + v.split(/\s+/).length, 0) / cells.length,
  );
  return `text of about ${words} word${words === 1 ? "" : "s"}${filled}`;
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
 * One spreadsheet row as student fields, each column filling the field
 * `mapping` gives it (the header rules when there's none). Cells are trimmed
 * and empty ones left out; when two columns fill one field the first filled
 * one wins. The student's name falls back to first + last name, the parent's
 * name to the father's, mother's or guardian's, and parent contact to the
 * student's.
 */
export function normalizeImportRow(
  row: Record<string, unknown>,
  mapping?: ColumnMapping,
): ImportRowValues {
  const cells: Partial<Record<ImportField, string>> = {};
  for (const [header, value] of Object.entries(row)) {
    const field = mapping
      ? (mapping[header] ?? null)
      : importFieldForHeader(header);
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
