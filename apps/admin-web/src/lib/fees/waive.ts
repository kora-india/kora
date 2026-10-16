import { FeeStatus, type Prisma } from "@schoolos/db";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** Item fields `waiveChargeItemInTx` needs. */
export interface WaivableItem {
  id: string;
  componentId: string;
  paidAmount: Prisma.Decimal | number;
  status: FeeStatus;
  charge: { studentId: string; title: string };
  component?: { name: string } | null;
}

/**
 * Waives what is still owed on a fee item, with an audit trail. Anything
 * already paid on it is credited to the student's advance for that component,
 * so the money stays on their account instead of vanishing from the totals.
 * The caller recomputes the parent charge's status.
 */
export async function waiveChargeItemInTx(
  tx: Prisma.TransactionClient,
  item: WaivableItem,
  waivedBy: string,
  reason: string,
): Promise<void> {
  if (item.status === FeeStatus.WAIVED) {
    throw new Error("This fee item has already been waived");
  }
  if (item.status === FeeStatus.PAID) {
    throw new Error(
      "This fee item is fully paid, so there is nothing to waive",
    );
  }

  const paidAmount = roundMoney(Number(item.paidAmount || 0));
  if (paidAmount > 0) {
    await tx.advanceLedger.create({
      data: {
        studentId: item.charge.studentId,
        componentId: item.componentId,
        amount: paidAmount,
        description: `Credit from waived ${item.component?.name || "fee"} (${item.charge.title})`,
      },
    });
  }

  await tx.feeChargeItem.update({
    where: { id: item.id },
    data: {
      status: FeeStatus.WAIVED,
      waivedBy,
      waivedAt: new Date(),
      waiverReason: reason,
    },
  });
}
