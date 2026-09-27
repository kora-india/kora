export interface AdmissionFormatConfig {
  prefix: string;
  format: string;
  nextSequence: number;
}

export interface AdmissionPreset {
  id: string;
  label: string;
  format: string;
  example: string;
}

export const ADMISSION_FORMAT_PRESETS: AdmissionPreset[] = [
  {
    id: "prefix-year-seq4",
    label: "Prefix - Year - 4 Digits",
    format: "{PREFIX}-{YYYY}-{SEQ:4}",
    example: "SCH-2026-0001",
  },
  {
    id: "prefix-slash-year-seq4",
    label: "Prefix / Year / 4 Digits",
    format: "{PREFIX}/{YYYY}/{SEQ:4}",
    example: "SCH/2026/0001",
  },
  {
    id: "prefix-slash-session-seq4",
    label: "Prefix / Session / 4 Digits",
    format: "{PREFIX}/{SESSION}/{SEQ:4}",
    example: "SCH/2026-27/0001",
  },
  {
    id: "prefix-year-seq3",
    label: "Prefix - Year - 3 Digits",
    format: "{PREFIX}-{YYYY}-{SEQ:3}",
    example: "SCH-2026-001",
  },
  {
    id: "year-prefix-seq4",
    label: "Year - Prefix - 4 Digits",
    format: "{YYYY}-{PREFIX}-{SEQ:4}",
    example: "2026-SCH-0001",
  },
  {
    id: "prefix-seq4",
    label: "Prefix - 4 Digits (No Year)",
    format: "{PREFIX}-{SEQ:4}",
    example: "SCH-0001",
  },
  {
    id: "prefix-seq3",
    label: "Prefix - 3 Digits (No Year)",
    format: "{PREFIX}-{SEQ:3}",
    example: "SCH-001",
  },
  {
    id: "prefix-compact-seq4",
    label: "Compact (No Delimiter)",
    format: "{PREFIX}{SEQ:4}",
    example: "SCH0001",
  },
];

/**
 * Formats an admission number from template tokens and sequence number.
 * Supported tokens:
 * - {PREFIX} -> School prefix (e.g. "DPS", "SCH")
 * - {YYYY}   -> 4-digit current year (e.g. "2026")
 * - {YY}     -> 2-digit current year (e.g. "26")
 * - {SESSION} -> Academic session (e.g. "2026-27")
 * - {SESSION:SHORT} -> Short session (e.g. "2627")
 * - {SEQ:N}  -> Zero-padded sequence to N digits (e.g. {SEQ:4} -> "0001")
 * - {SEQ}    -> Defaults to 4 digits (e.g. "0001")
 */
export function formatAdmissionNumber(
  template: string,
  prefix: string,
  sequence: number,
  date: Date = new Date(),
): string {
  const cleanPrefix = (prefix || "SCH").trim().toUpperCase();
  const year4 = date.getFullYear().toString();
  const year2 = year4.slice(-2);

  // Compute academic session (assuming April - March session cycle standard in schools)
  const month = date.getMonth(); // 0 is January, 3 is April
  const startYear = month >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const nextYear2 = ((startYear + 1) % 100).toString().padStart(2, "0");
  const sessionFull = `${startYear}-${nextYear2}`;
  const sessionShort = `${startYear.toString().slice(-2)}${nextYear2}`;

  let result = (template || "{PREFIX}-{YYYY}-{SEQ:4}").trim();

  // Replace {PREFIX}
  result = result.replace(/\{PREFIX\}/gi, cleanPrefix);

  // Replace {YYYY} and {YY}
  result = result.replace(/\{YYYY\}/gi, year4);
  result = result.replace(/\{YY\}/gi, year2);

  // Replace {SESSION} and {SESSION:SHORT}
  result = result.replace(/\{SESSION:SHORT\}/gi, sessionShort);
  result = result.replace(/\{SESSION\}/gi, sessionFull);

  // Replace {SEQ:N} or {SEQ}
  result = result.replace(/\{SEQ(?::(\d+))?\}/gi, (_, digits) => {
    const pad = digits ? parseInt(digits, 10) : 4;
    return Math.max(1, sequence).toString().padStart(pad, "0");
  });

  return result;
}
