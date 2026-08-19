"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeStatus } from "@schoolos/db";
import { revalidatePath } from "next/cache";

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function runLegacyFeeMigration() {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create a generic Academic Session for Legacy Data
      let legacySession = await tx.academicSession.findFirst({
        where: { schoolId: user.schoolId, name: "Legacy Initial Data" }
      });

      if (!legacySession) {
        legacySession = await tx.academicSession.create({
          data: {
            schoolId: user.schoolId,
            name: "Legacy Initial Data",
            startDate: new Date("2020-01-01"),
            endDate: new Date("2030-12-31"),
            isCurrent: false
          }
        });
      }

      // 2. Fetch all legacy fees
      const legacyFees = await tx.fee.findMany({
        where: { schoolId: user.schoolId },
        include: { payments: true }
      });

      let migratedCount = 0;

      for (const oldFee of legacyFees) {
        // Create a component dynamically based on old feeType if it doesn't exist
        let comp = await tx.feeComponent.findFirst({
          where: { schoolId: user.schoolId, name: oldFee.feeType }
        });
        
        if (!comp) {
          comp = await tx.feeComponent.create({
            data: {
              schoolId: user.schoolId,
              name: oldFee.feeType,
              amount: oldFee.amount,
              frequency: "ONE_TIME"
            }
          });
        }

        const totalPaidForOldFee = oldFee.payments.reduce((s: any, p: any) => s + Number(p.amount), 0);
        const itemStatus = oldFee.status === "PAID" ? FeeStatus.PAID : oldFee.status === "PENDING" ? FeeStatus.PENDING : FeeStatus.PARTIAL;

        // Create the FeeCharge equivalent
        const newCharge = await tx.feeCharge.create({
          data: {
            schoolId: user.schoolId,
            studentId: oldFee.studentId,
            sessionId: legacySession.id,
            title: `Legacy: ${oldFee.feeType} (${oldFee.dueDate.toDateString()})`,
            dueDate: oldFee.dueDate,
            status: itemStatus,
            items: {
              create: {
                componentId: comp.id,
                amount: oldFee.amount,
                paidAmount: totalPaidForOldFee,
                status: itemStatus
              }
            }
          },
          include: { items: true }
        });

        // Migrate payments for this fee
        for (const oldPayment of oldFee.payments) {
          const newPayment = await tx.paymentTransaction.create({
            data: {
              schoolId: user.schoolId,
              studentId: oldFee.studentId,
              amount: oldPayment.amount,
              method: oldPayment.method as any || "CASH",
              receiptNo: oldPayment.receiptNo,
              date: oldPayment.paidAt,
              remarks: oldPayment.remarks
            }
          });

          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              chargeItemId: newCharge.items[0].id,
              amount: oldPayment.amount
            }
          });
        }
        
        migratedCount++;
      }

      return { migratedCount };
    }, { maxWait: 15000, timeout: 60000 });

    return { success: true, migratedCount: result.migratedCount };
  } catch (e: any) {
    return { error: e.message };
  }
}
