import { Prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import type { ActionResult } from "@/lib/action-result";

const logger = createLogger("actions");

const FIELD_LABELS: Record<string, string> = {
  email: "email address",
  phone: "phone number",
  subdomain: "school ID",
  receiptNo: "receipt number",
  admissionNumber: "admission number",
  rollNumber: "roll number",
  employeeId: "employee ID",
  slipNumber: "slip number",
  name: "name",
};

function uniqueFieldLabel(meta: unknown): string {
  const target = (meta as { target?: unknown } | undefined)?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? target.split("_")
      : [];
  const known = fields.map((f) => FIELD_LABELS[f]).find(Boolean);
  return known ?? "value";
}

/**
 * A message staff can act on (U4). Known database errors become plain
 * sentences and other database errors are logged and replaced by
 * `fallback`, so Prisma's text ("Unique constraint failed on the fields:
 * (`receiptNo`)") never reaches the screen. Errors the app throws on purpose
 * keep their message.
 */
export function actionErrorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2002":
        return `That ${uniqueFieldLabel(e.meta)} is already in use.`;
      case "P2003":
        return "This is linked to other records, so it can't be changed or removed.";
      case "P2025":
        return "This record no longer exists. Refresh the page and try again.";
    }
  }
  if (
    e instanceof Prisma.PrismaClientKnownRequestError ||
    e instanceof Prisma.PrismaClientUnknownRequestError ||
    e instanceof Prisma.PrismaClientValidationError ||
    e instanceof Prisma.PrismaClientInitializationError ||
    e instanceof Prisma.PrismaClientRustPanicError ||
    !(e instanceof Error) ||
    !e.message
  ) {
    logger.error({ err: e }, "Unexpected server action error");
    return fallback;
  }
  return e.message;
}

/** Runs an action body, returning its value or the error as a message. */
export async function toActionResult<T>(
  run: () => Promise<T>,
  fallback?: string,
): Promise<ActionResult<T>> {
  try {
    return { data: await run() };
  } catch (e) {
    // Let Next.js redirects and notFound() through.
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    return { error: actionErrorMessage(e, fallback) };
  }
}
