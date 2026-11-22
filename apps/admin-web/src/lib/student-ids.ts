import { z } from "zod";

/**
 * A student's PAN and APAAR ID: how they're written down, checked and
 * compared. Both are optional, and each belongs to one student in a school.
 *
 * PAN: 10 characters, five letters, four digits, one letter (ABCDE1234F).
 * APAAR ID ("One Nation One Student ID"): 12 digits.
 */

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const APAAR = /^[0-9]{12}$/;

export const PAN_PROBLEM = "PAN must look like ABCDE1234F";
export const APAAR_PROBLEM = "APAAR ID must be 12 digits";

/** "abcde 1234 f" -> "ABCDE1234F"; spaces and dashes people type are dropped. */
export const normalizePan = (raw: string) =>
  raw.replace(/[\s-]/g, "").toUpperCase();

/** "1234 5678 9012" -> "123456789012". */
export const normalizeApaar = (raw: string) => raw.replace(/[\s-]/g, "");

export const isPan = (value: string) => PAN.test(value);
export const isApaarId = (value: string) => APAAR.test(value);

/** Spreadsheets hand over a long number for an APAAR ID; read it as text. */
const asText = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(0) : v;

/** An optional ID field: blank becomes null, anything else is cleaned up and must match. */
function idField(
  normalize: (raw: string) => string,
  test: (value: string) => boolean,
  message: string,
) {
  return z.preprocess(
    (v) => {
      const text = asText(v);
      if (text === null || text === undefined) return null;
      if (typeof text !== "string") return text;
      const cleaned = normalize(text.trim());
      return cleaned === "" ? null : cleaned;
    },
    z
      .string({ invalid_type_error: message })
      .refine(test, message)
      .nullable()
      .optional(),
  );
}

export const PanSchema = idField(normalizePan, isPan, PAN_PROBLEM);
export const ApaarIdSchema = idField(normalizeApaar, isApaarId, APAAR_PROBLEM);

/** A Prisma unique-constraint error's field, for a readable message. */
export function duplicateField(e: unknown): string | null {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== "P2002") return null;
  const target = err.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : [String(target ?? "")];
  if (fields.some((f) => f.includes("panNumber"))) return "panNumber";
  if (fields.some((f) => f.includes("apaarId"))) return "apaarId";
  if (fields.some((f) => f.includes("admissionNumber")))
    return "admissionNumber";
  return fields[0] ?? null;
}
