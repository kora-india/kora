import { FeeStatus, type Prisma } from "@schoolos/db";

/**
 * A charge's status from its items. Matches the late-fee cron, which moves
 * unpaid and part-paid charges past their due date to OVERDUE.
 */
export function deriveChargeStatus(
  items: { status: FeeStatus | string }[],
  dueDate: Date,
  today: Date,
): FeeStatus {
  if (items.length > 0 && items.every((i) => i.status === FeeStatus.WAIVED)) {
    return FeeStatus.WAIVED;
  }
  if (
    items.every(
      (i) => i.status === FeeStatus.PAID || i.status === FeeStatus.WAIVED,
    )
  ) {
    return FeeStatus.PAID;
  }
  if (dueDate < today) return FeeStatus.OVERDUE;
  if (
    items.some(
      (i) => i.status === FeeStatus.PAID || i.status === FeeStatus.PARTIAL,
    )
  ) {
    return FeeStatus.PARTIAL;
  }
  return FeeStatus.PENDING;
}

export async function recomputeChargeStatus(
  tx: Prisma.TransactionClient,
  chargeId: string,
  today: Date,
): Promise<FeeStatus> {
  const charge = await tx.feeCharge.findUniqueOrThrow({
    where: { id: chargeId },
    select: { dueDate: true, items: { select: { status: true } } },
  });
  const status = deriveChargeStatus(charge.items, charge.dueDate, today);
  await tx.feeCharge.update({ where: { id: chargeId }, data: { status } });
  return status;
}
