import { z } from "zod";
import { isPan, normalizePan, PAN_PROBLEM } from "@/lib/student-ids";

/**
 * A teacher's or staff member's ID and bank details, and the documents kept
 * for them: what each looks like, how it's shown, and how it's checked.
 * Shared by the browser and the server.
 */

// --- Aadhaar -----------------------------------------------------------------

// Verhoeff tables: Aadhaar's last digit is a Verhoeff check digit, so a
// mistyped digit (or two swapped) is caught.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Whether a string of digits ends in a valid Verhoeff check digit. */
export function verhoeffValid(digits: string) {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = D[c][P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
}

/** 12 digits, not starting with 0 or 1, with a valid check digit. */
export const isAadhaar = (value: string) =>
  /^[2-9][0-9]{11}$/.test(value) && verhoeffValid(value);

// --- Other numbers ---------------------------------------------------------------

export const isIfsc = (value: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
export const isBankAccount = (value: string) => /^[0-9]{9,18}$/.test(value);
export const isUan = (value: string) => /^[0-9]{12}$/.test(value);
export const isUpiId = (value: string) =>
  /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(value);

const digitsOnly = (raw: string) => raw.replace(/[\s-]/g, "");

/** "XXXX XXXX 1234" from the last four digits. */
export const maskAadhaar = (last4: string | null | undefined) =>
  last4 ? `XXXX XXXX ${last4}` : null;
/** "XXXXXX5678" from the last four digits. */
export const maskAccount = (last4: string | null | undefined) =>
  last4 ? `XXXXXX${last4}` : null;

/** "1234 5678 9012" for reading an Aadhaar number aloud. */
export const formatAadhaar = (value: string) =>
  value.replace(/(\d{4})(?=\d)/g, "$1 ");

// --- The details form ---------------------------------------------------------

/** An optional field: blank is null; otherwise cleaned up and checked. */
const optional = (
  clean: (raw: string) => string,
  test: (value: string) => boolean,
  message: string,
) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v !== "string") return v;
      const cleaned = clean(v.trim());
      return cleaned === "" ? null : cleaned;
    },
    z.string({ invalid_type_error: message }).refine(test, message).nullable(),
  );

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .trim()
      .max(max, `${label} must be at most ${max} characters`)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  );

export const EmployeeDetailsSchema = z.object({
  aadhaarNumber: optional(
    digitsOnly,
    isAadhaar,
    "That isn't a valid Aadhaar number. Check the 12 digits.",
  ),
  panNumber: optional(normalizePan, isPan, PAN_PROBLEM),
  uanNumber: optional(digitsOnly, isUan, "UAN must be 12 digits"),
  bankAccountHolder: optionalText(100, "Account holder name"),
  bankName: optionalText(100, "Bank name"),
  bankAccountNumber: optional(
    digitsOnly,
    isBankAccount,
    "Account number must be 9 to 18 digits",
  ),
  bankIfsc: optional(
    (raw) => raw.replace(/\s/g, "").toUpperCase(),
    isIfsc,
    "IFSC must look like SBIN0001234",
  ),
  upiId: optional(
    (raw) => raw.replace(/\s/g, ""),
    isUpiId,
    "UPI ID must look like name@bank",
  ),
});

export type EmployeeDetailsInput = z.input<typeof EmployeeDetailsSchema>;

/** The details as the person editing them sees them (numbers in full). */
export interface EmployeeDetails {
  aadhaarNumber: string | null;
  panNumber: string | null;
  uanNumber: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  updatedAt: string | null;
}

export const EMPTY_DETAILS: EmployeeDetails = {
  aadhaarNumber: null,
  panNumber: null,
  uanNumber: null,
  bankAccountHolder: null,
  bankName: null,
  bankAccountNumber: null,
  bankIfsc: null,
  upiId: null,
  updatedAt: null,
};

// --- Documents --------------------------------------------------------------------

export const DOCUMENT_KINDS = {
  AADHAAR: "Aadhaar card",
  PAN: "PAN card",
  MARKSHEET: "Marksheet",
  CERTIFICATE: "Certificate / degree",
  EXPERIENCE: "Experience letter",
  BANK: "Bank passbook / cheque",
  PHOTO: "Photo",
  RESUME: "Resume / CV",
  OTHER: "Other",
} as const;

export type DocumentKind = keyof typeof DOCUMENT_KINDS;
export const DOCUMENT_KIND_KEYS = Object.keys(DOCUMENT_KINDS) as [
  DocumentKind,
  ...DocumentKind[],
];

/** What a document file can be, by MIME type and by Cloudinary's format. */
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const DOCUMENT_FORMATS = ["pdf", "jpg", "jpeg", "png", "webp"];
/** Cloudinary's limit for a file on the free plan. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_HINT = "PDF, JPG, PNG or WebP, up to 10 MB.";

/** Why a file can't be kept as a document, or null when it can. */
export function documentFileProblem(file: { type: string; size: number }) {
  if (!DOCUMENT_TYPES[file.type]) return "Use a PDF, JPG, PNG or WebP file.";
  if (file.size > DOCUMENT_MAX_BYTES) return "A document can be up to 10 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

export interface EmployeeDocumentRecord {
  id: string;
  kind: DocumentKind;
  title: string | null;
  fileName: string;
  format: string | null;
  bytes: number | null;
  uploadedByName: string;
  createdAt: string;
}

/** "Aadhaar card" or "Marksheet: Class 12". */
export const documentLabel = (doc: { kind: string; title: string | null }) => {
  const kind = DOCUMENT_KINDS[doc.kind as DocumentKind] ?? "Document";
  return doc.title ? `${kind}: ${doc.title}` : kind;
};

/** "1.2 MB", "340 KB". */
export function fileSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
