"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeStatus, PaymentMethod } from "@schoolos/db";
import { revalidatePath } from "next/cache";

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function processPayment(data: {
  studentId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  remarks?: string;
  manualAllocations?: { chargeId: string; amount: number }[];
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  if (data.amount <= 0) return { error: "Payment amount must be greater than zero." };

  try {
    const receiptNo = `RCP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment Transaction
      const payment = await tx.paymentTransaction.create({
        data: {
          schoolId: user.schoolId,
          studentId: data.studentId,
          amount: data.amount,
          method: data.method,
          reference: data.reference,
          receiptNo,
          remarks: data.remarks,
          status: "SUCCESS"
        }
      });

      let remainingAmount = Number(data.amount);
      const allocationsCreated = [];

      // 2. Consume existing Advance Balance if we are allocating manually? No, payment is new money.
      // If manual allocations are provided, use them. Otherwise auto-allocate.
      if (data.manualAllocations && data.manualAllocations.length > 0) {
        for (const alloc of data.manualAllocations) {
          if (remainingAmount <= 0) break;
          const allocAmount = Math.min(alloc.amount, remainingAmount);
          
          allocationsCreated.push({
            paymentId: payment.id,
            chargeId: alloc.chargeId,
            amount: allocAmount
          });
          remainingAmount -= allocAmount;
        }
      } else {
        // Auto-allocate: Oldest pending/partial charges first
        const charges = await tx.feeCharge.findMany({
          where: { 
            studentId: data.studentId, 
            status: { in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE] } 
          },
          include: { items: true, allocations: true },
          orderBy: { dueDate: 'asc' }
        });

        for (const charge of charges) {
          if (remainingAmount <= 0) break;

          const totalChargeAmount = charge.items.reduce((sum, item) => sum + Number(item.amount), 0);
          const alreadyPaid = charge.allocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);
          const due = totalChargeAmount - alreadyPaid;

          if (due > 0) {
            const allocAmount = Math.min(due, remainingAmount);
            allocationsCreated.push({
              paymentId: payment.id,
              chargeId: charge.id,
              amount: allocAmount
            });
            remainingAmount -= allocAmount;
          }
        }
      }

      // 3. Create Allocations
      if (allocationsCreated.length > 0) {
        await tx.paymentAllocation.createMany({
          data: allocationsCreated
        });
      }

      // 4. Update Charge Statuses
      const affectedChargeIds = allocationsCreated.map(a => a.chargeId);
      // We need to recalculate status for all affected charges
      for (const chargeId of new Set(affectedChargeIds)) {
        const charge = await tx.feeCharge.findUnique({
          where: { id: chargeId },
          include: { items: true, allocations: true }
        });
        if (!charge) continue;

        const totalChargeAmount = charge.items.reduce((sum, item) => sum + Number(item.amount), 0);
        const totalPaid = charge.allocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);

        let newStatus = charge.status;
        if (totalPaid >= totalChargeAmount) {
          newStatus = FeeStatus.PAID;
        } else if (totalPaid > 0) {
          newStatus = FeeStatus.PARTIAL;
        }

        if (newStatus !== charge.status) {
          await tx.feeCharge.update({
            where: { id: charge.id },
            data: { status: newStatus }
          });
        }
      }

      // 5. Add any remaining amount to Advance Ledger
      if (remainingAmount > 0) {
        await tx.advanceLedger.create({
          data: {
            studentId: data.studentId,
            amount: remainingAmount,
            description: `Advance from payment ${receiptNo}`
          }
        });
      }

      return { receiptNo, remainingAdvance: remainingAmount };
    });

    revalidatePath("/fees");
    return { success: true, ...result };
  } catch (e: any) {
    return { error: e.message };
  }
}
