import type { Prisma } from "@schoolos/db";
import { calendarDateInTimeZone } from "./timezone";

const DEFAULT_PREFIX = "RCP";
const DEFAULT_FORMAT = "{PREFIX}-{YYYY}-{SEQ:5}";
const MAX_SKIPS = 50;

/**
 * Formats a receipt number. Tokens: {PREFIX}, {YYYY}, {YY}, {SEQ} / {SEQ:N}.
 * A format without {SEQ} gets one appended, so numbers stay unique.
 */
export function formatReceiptNumber(
  format: string | null | undefined,
  prefix: string | null | undefined,
  sequence: number,
  year: number,
): string {
  let template = (format || DEFAULT_FORMAT).trim();
  if (!/\{SEQ(?::\d+)?\}/i.test(template)) template += "-{SEQ:5}";

  return template
    .replace(/\{PREFIX\}/gi, (prefix || DEFAULT_PREFIX).trim().toUpperCase())
    .replace(/\{YYYY\}/gi, String(year))
    .replace(/\{YY\}/gi, String(year).slice(-2))
    .replace(/\{SEQ(?::(\d+))?\}/gi, (_, digits) =>
      String(sequence).padStart(digits ? Number(digits) : 5, "0"),
    );
}

/**
 * Allocates the school's next receipt number inside a payment transaction.
 *
 * The counter update takes a row lock on the school that is held until the
 * transaction ends. That serializes concurrent payments for the same school,
 * which is what keeps the read-then-update of fee item balances in
 * `allocatePayment` safe. Numbers already used (for example by receipts
 * issued before sequential numbering) are skipped.
 */
export async function allocateReceiptNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
  timeZone: string,
  now = new Date(),
): Promise<string> {
  const year = Number(calendarDateInTimeZone(timeZone, now).slice(0, 4));

  for (let attempt = 0; attempt < MAX_SKIPS; attempt++) {
    const school = await tx.school.update({
      where: { id: schoolId },
      data: { nextReceiptNumber: { increment: 1 } },
      select: {
        nextReceiptNumber: true,
        receiptPrefix: true,
        receiptFormat: true,
      },
    });
    const receiptNo = formatReceiptNumber(
      school.receiptFormat,
      school.receiptPrefix,
      school.nextReceiptNumber - 1,
      year,
    );
    const taken = await tx.paymentTransaction.findFirst({
      where: { schoolId, receiptNo },
      select: { id: true },
    });
    if (!taken) return receiptNo;
  }

  throw new Error(
    "Couldn't allocate a free receipt number. Check the school's receipt format.",
  );
}
