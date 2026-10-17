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
