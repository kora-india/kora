/**
 * Idempotency key for one fee payment attempt. The fee screens send the same
 * key when a submit is retried (double click, dropped connection), so the
 * server returns the original receipt instead of recording a second payment.
 */
export function newPaymentKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
