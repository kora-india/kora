/**
 * Fee collection logic shared by the Fees > Collection tab and the student's
 * fee screen (U11), so the two can't drift apart: the month list, the
 * school's partial-payment policy (the same rule the server enforces in
 * `allocatePayment`), and, in ./payment-split, how a payment is split.
 */

export interface CollectionItem {
  id: string;
  componentId: string;
  componentName: string;
  amount: number;
  paidAmount: number;
  due: number;
  status: "WAIVED" | "PAID" | "PARTIAL" | "PENDING";
  isLateFee: boolean;
}

export interface CollectionMonth {
  id: string;
  title: string;
  dueDate: string | Date;
  status: string;
  /** Everything billed for the month, waived items included. */
  netCharge: number;
  /** Billed excluding waived items: what the partial minimum is based on. */
  billed: number;
  paidAmount: number;
  totalDue: number;
  items: CollectionItem[];
}

export interface FeePolicy {
  mode: string;
  minPercentage: number;
  minAmount: number;
}

const money = (n: number) => Math.round(n * 100) / 100;

type ComponentInfo = { id: string; name?: string; category?: string | null };

/** Months with something still due, and the student's total outstanding. */
export function buildMonthList(
  charges: any[],
  components: ComponentInfo[] = [],
): { monthList: CollectionMonth[]; totalOutstanding: number } {
  let totalOutstanding = 0;
  const list = (charges || []).map((charge: any): CollectionMonth => {
    let netCharge = 0;
    let billed = 0;
    let paidAmount = 0;
    let totalDue = 0;

    const items = (charge.items || []).map((item: any): CollectionItem => {
      const amt = Number(item.amount || 0);
      const paid = Number(item.paidAmount || 0);
      const waived = item.status === "WAIVED";
      const due = waived ? 0 : Math.max(0, amt - paid);
      const known = components.find((c) => c.id === item.componentId);
      const componentName = item.component?.name || known?.name || "Fee";
      const category = item.component?.category || known?.category;

      netCharge += amt;
      if (!waived) billed += amt;
      paidAmount += paid;
      totalDue += due;

      return {
        id: item.id,
        componentId: item.componentId,
        componentName,
        amount: amt,
        paidAmount: paid,
        due,
        status: waived
          ? "WAIVED"
          : due <= 0
            ? "PAID"
            : paid > 0
              ? "PARTIAL"
              : "PENDING",
        isLateFee: category === "LATE_FEE" || /\blate\b/i.test(componentName),
      };
    });

    totalOutstanding += totalDue;
    return {
      id: charge.id,
      title: charge.title,
      dueDate: charge.dueDate,
      status: charge.status,
      netCharge,
      billed: money(billed),
      paidAmount,
      totalDue,
      items,
    };
  });

  return {
    monthList: list.filter((m) => m.totalDue > 0),
    totalOutstanding,
  };
}

export function feePolicyOf(school: any): FeePolicy {
  return {
    mode: school?.feePaymentMode || "ALLOW_PARTIAL",
    minPercentage: Number(school?.minPartialPaymentPercentage || 0),
    minAmount: Number(school?.minPartialPaymentAmount || 0),
  };
}

const describeMinimum = (policy: FeePolicy, min: number) =>
  policy.minPercentage > 0 ? `${policy.minPercentage}% (₹${min})` : `₹${min}`;

/** Why paying `amount` for this month breaks the school's policy, or null. */
export function monthPolicyError(
  month: CollectionMonth,
  amount: number,
  policy: FeePolicy,
): string | null {
  const due = money(month.totalDue);
  if (amount <= 0 || amount >= due) return null;
  if (policy.mode === "FULL_ONLY") {
    return `School policy requires clearing ${month.title} fully (₹${due}). Partial payments are disabled.`;
  }
  if (policy.mode !== "ALLOW_PARTIAL") return null;
  const min =
    policy.minPercentage > 0
      ? money((month.billed * policy.minPercentage) / 100)
      : policy.minAmount;
  if (min <= 0) return null;
  if (due <= min) {
    return `The remaining due for ${month.title} is ₹${due}, which is at or below the minimum partial payment of ${describeMinimum(policy, min)}. It must be cleared in full.`;
  }
  if (amount < min) {
    return `Payment for ${month.title} must be at least ${describeMinimum(policy, min)}.`;
  }
  return null;
}

/** The first policy problem among the selected months, or null. */
export function firstPolicyError(
  months: CollectionMonth[],
  selected: Record<string, boolean>,
  monthAmounts: Record<string, string>,
  policy: FeePolicy,
): string | null {
  for (const month of months) {
    if (!selected[month.id]) continue;
    const error = monthPolicyError(
      month,
      Number(monthAmounts[month.id]) || 0,
      policy,
    );
    if (error) return error;
  }
  return null;
}
