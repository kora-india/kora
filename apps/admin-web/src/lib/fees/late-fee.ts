/** A school's late-fee rule, as numbers. */
export interface LateFeeRule {
  lateFeeAmount: number;
  lateFeeFrequency: string | null;
  maxLateFeeCap: number | null;
}

/**
 * The late fee on a bill this many days overdue. The daily job and the fee
 * history import both use this, so they always agree. `principal` is the
 * bill without its late fee.
 */
export function calculateLateFee(
  rule: LateFeeRule,
  daysOverdue: number,
  principal: number,
): number {
  if (daysOverdue <= 0) return 0;

  // B13: Safety caps on late fee multiplier
  let multiplier: number;
  if (rule.lateFeeFrequency === "DAILY") {
    multiplier = Math.min(daysOverdue, 30); // Max 30 days daily penalty
  } else if (rule.lateFeeFrequency === "WEEKLY") {
    multiplier = Math.min(Math.ceil(daysOverdue / 7), 5); // Max 5 weeks
  } else {
    // MONTHLY default
    multiplier = Math.min(Math.max(1, Math.ceil(daysOverdue / 30)), 3); // Max 3 months
  }

  let total = rule.lateFeeAmount * multiplier;

  // B13: Cap late fee by school setting and 50% of charge principal
  if (rule.maxLateFeeCap) total = Math.min(total, rule.maxLateFeeCap);
  if (principal > 0) {
    total = Math.min(
      total,
      Math.max(rule.lateFeeAmount, Math.round(principal * 0.5)),
    );
  }
  return Math.round(total * 100) / 100;
}
