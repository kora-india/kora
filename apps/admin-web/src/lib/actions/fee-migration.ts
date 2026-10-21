"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeStatus } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { invalidateFeesCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  // B14: Restrict legacy migration strictly to SUPER_ADMIN or SCHOOL_ADMIN
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function runLegacyFeeMigration() {
  const user = await getAdminSession();
  if (!user)
    return {
      error:
        "Forbidden: Only SUPER_ADMIN or SCHOOL_ADMIN can run fee migration",
    };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create or get generic Academic Session for Legacy Data
        let legacySession = await tx.academicSession.findFirst({
          where: { schoolId: user.schoolId, name: "Legacy Initial Data" },
        });

        if (!legacySession) {
          legacySession = await tx.academicSession.create({
            data: {
              schoolId: user.schoolId,
              name: "Legacy Initial Data",
              startDate: new Date("2020-01-01"),
              endDate: new Date("2030-12-31"),
              isCurrent: false,
            },
          });
        }

        // 2. Fetch only unmigrated legacy fees
        const legacyFees = await tx.fee.findMany({
          where: { schoolId: user.schoolId, isMigrated: false },
          include: { payments: true },
        });

        let migratedCount = 0;

        for (const oldFee of legacyFees) {
          // Find or create FeeComponent for legacy feeType
          let comp = await tx.feeComponent.findFirst({
            where: { schoolId: user.schoolId, name: oldFee.feeType },
          });

          if (!comp) {
            comp = await tx.feeComponent.create({
              data: {
                schoolId: user.schoolId,
                name: oldFee.feeType,
                amount: oldFee.amount,
                frequency: "ONE_TIME",
                category: "GENERAL",
                isActive: true,
              },
            });
          }

          const totalPaidForOldFee = oldFee.payments.reduce(
            (s: number, p: any) => s + Number(p.amount),
            0,
          );

          // B14: Accurate status mapping including WAIVED and OVERDUE
          let itemStatus: FeeStatus;
          if (oldFee.status === "PAID") itemStatus = FeeStatus.PAID;
          else if (oldFee.status === "WAIVED") itemStatus = FeeStatus.WAIVED;
          else if (oldFee.status === "OVERDUE") itemStatus = FeeStatus.OVERDUE;
          else if (oldFee.status === "PARTIAL" || totalPaidForOldFee > 0)
            itemStatus = FeeStatus.PARTIAL;
          else itemStatus = FeeStatus.PENDING;

          // B17: Create standard modern FeeCharge and FeeChargeItem
          const newCharge = await tx.feeCharge.create({
            data: {
              schoolId: user.schoolId,
              studentId: oldFee.studentId,
              sessionId: legacySession.id,
              title: `Legacy: ${oldFee.feeType} (${oldFee.dueDate.toDateString()})`,
              periodKey: `legacy-${oldFee.id}`,
              dueDate: oldFee.dueDate,
              status: itemStatus,
              items: {
                create: {
                  componentId: comp.id,
                  amount: oldFee.amount,
                  paidAmount: totalPaidForOldFee,
                  status: itemStatus,
                },
              },
            },
            include: { items: true },
          });

          // Migrate payments for this fee
          for (const oldPayment of oldFee.payments) {
            const receiptNo =
              oldPayment.receiptNo || `LEGACY-RCP-${oldPayment.id.slice(-8)}`;

            // Check if receipt already exists in school
            const existingPayment = await tx.paymentTransaction.findFirst({
              where: { schoolId: user.schoolId, receiptNo },
            });

            const finalReceiptNo = existingPayment
              ? `${receiptNo}-${Math.random().toString(36).substring(2, 6)}`
              : receiptNo;

            const newPayment = await tx.paymentTransaction.create({
              data: {
                schoolId: user.schoolId,
                studentId: oldFee.studentId,
                amount: oldPayment.amount,
                method: (oldPayment.method as any) || "CASH",
                receiptNo: finalReceiptNo,
                date: oldPayment.paidAt || oldPayment.createdAt,
                remarks: oldPayment.remarks || "Migrated legacy payment",
              },
            });

            await tx.paymentAllocation.create({
              data: {
                paymentId: newPayment.id,
                chargeItemId: newCharge.items[0].id,
                amount: oldPayment.amount,
              },
            });
          }

          // B14: Mark fee as migrated
          await tx.fee.update({
            where: { id: oldFee.id },
            data: {
              isMigrated: true,
              migratedChargeId: newCharge.id,
            },
          });

          migratedCount++;
        }

        return { migratedCount };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    await invalidateFeesCache(user.schoolId);
    revalidatePath("/fees");
    revalidatePath("/dashboard");

    return { success: true, migratedCount: result.migratedCount };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
