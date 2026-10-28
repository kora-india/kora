"use server";

import { z } from "zod";
import { prisma, FeeStatus, PaymentMethod, type Prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { invalidateFeesCache, invalidateCache } from "@/lib/redis";
import { requirePermission } from "@/lib/auth-guard";
import { allocateReceiptNumber } from "@/lib/fees/receipt-number";
import { recomputeChargeStatus } from "@/lib/fees/charge-status";
import { waiveChargeItemInTx } from "@/lib/fees/waive";
import {
  formatDateTimeInTimeZone,
  resolveTimeZone,
  todayInTimeZone,
} from "@/lib/fees/timezone";
import { actionErrorMessage } from "@/lib/action-errors";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** Reading dues and receipts needs fees view; anything that moves money, manage. */
async function getFinanceSession(level: "view" | "manage" = "manage") {
  const guard = await requirePermission("fees", level);
  if ("error" in guard) return null;
  return guard;
}

function isIdempotencyConflict(e: any): boolean {
  return (
    e?.code === "P2002" &&
    JSON.stringify(e?.meta?.target ?? "").includes("idempotencyKey")
  );
}

export interface FeeReceiptItem {
  head: string;
  amount: number;
}

export interface FeeReceiptMonthAllocation {
  chargeId: string;
  month: string;
  dueDate?: string | Date;
  feeDue: number; // Original month bill
  previouslyPaid: number; // Paid before this transaction
  paidNow: number; // Paid in this transaction
  balanceDue: number; // Remaining after this transaction
  status: "PAID" | "PARTIALLY PAID" | "UNPAID";
  coveragePercent?: number; // e.g. 80
}

export interface FeeReceiptData {
  schoolName: string;
  schoolAddress: string;
  schoolContact: string;
  timestamp: string;
  receiptNo: string;
  regNo: string;
  rollNumber?: string;
  studentName: string;
  className: string;
  items: FeeReceiptItem[];
  total: number;
  amountPaid: number;
  paidForMonths: string;
  paymentType: string;
  generatedBy: string;

  // Partial vs Clearance Bill tracking
  isPartial: boolean;
  documentType: "OFFICIAL_RECEIPT" | "PARTIAL_INVOICE";
  monthTotalBilled: number;
  monthTotalPaid: number;
  monthRemainingDue: number;

  // Summary & Allocation Fields
  outstandingBefore: number;
  remainingOutstanding: number;
  paymentStatus: "PAID_IN_FULL" | "PARTIAL_PAYMENT";
  paymentStatusText: string;
  monthAllocations: FeeReceiptMonthAllocation[];

  // Multi-month and late fee metadata
  monthCount?: number;
  lateFeeTotal?: number;
}

const allocatePaymentInputSchema = z
  .object({
    studentId: z.string().min(1, "Student ID is required"),
    monthPayments: z
      .array(
        z.object({
          chargeId: z.string().min(1),
          amount: z
            .number()
            .positive("Payment amount must be greater than zero.")
            .max(10_000_000),
        }),
      )
      .optional(),
    itemPayments: z
      .array(
        z.object({
          chargeItemId: z.string().min(1),
          amount: z
            .number()
            .positive("Payment amount must be greater than zero.")
            .max(10_000_000),
        }),
      )
      .optional(),
    componentPayments: z
      .array(
        z.object({
          componentId: z.string().min(1),
          amount: z
            .number()
            .positive("Payment amount must be greater than zero.")
            .max(10_000_000),
        }),
      )
      .optional(),
    generalAdvanceAmount: z
      .number()
      .positive("Payment amount must be greater than zero.")
      .max(10_000_000)
      .optional(),
    method: z.nativeEnum(PaymentMethod),
    reference: z.string().optional(),
    remarks: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })
  // Charges and items are read once up front (P5), so the same one listed
  // twice would be allocated from stale balances. One entry each.
  .refine(
    (d) =>
      new Set((d.monthPayments ?? []).map((m) => m.chargeId)).size ===
      (d.monthPayments ?? []).length,
    { message: "Each month can appear only once in a payment." },
  )
  .refine(
    (d) =>
      new Set((d.itemPayments ?? []).map((i) => i.chargeItemId)).size ===
      (d.itemPayments ?? []).length,
    { message: "Each fee item can appear only once in a payment." },
  );

export async function allocatePayment(rawInput: {
  studentId: string;
  monthPayments?: { chargeId: string; amount: number }[];
  itemPayments?: { chargeItemId: string; amount: number }[];
  componentPayments?: { componentId: string; amount: number }[];
  generalAdvanceAmount?: number;
  method: PaymentMethod;
  reference?: string;
  remarks?: string;
  idempotencyKey?: string;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  // B6: Input validation
  const parsed = allocatePaymentInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    // If any amount was zero or negative or invalid, provide a clear message
    const msg = parsed.error.issues[0]?.message || "Invalid payment input";
    return {
      error: msg.includes("greater than zero")
        ? "Payment amount must be greater than zero."
        : msg,
    };
  }

  const data = parsed.data;

  const monthTotal = roundMoney(
    (data.monthPayments || []).reduce((sum, mp) => sum + mp.amount, 0),
  );
  const itemTotal = roundMoney(
    (data.itemPayments || []).reduce((sum, ip) => sum + ip.amount, 0),
  );
  const componentTotal = roundMoney(
    (data.componentPayments || []).reduce((sum, cp) => sum + cp.amount, 0),
  );
  const totalPayment = roundMoney(
    monthTotal + itemTotal + componentTotal + (data.generalAdvanceAmount || 0),
  );

  if (totalPayment <= 0)
    return { error: "Payment amount must be greater than zero." };

  try {
    // B6: Idempotency check
    if (data.idempotencyKey) {
      const existing = await prisma.paymentTransaction.findUnique({
        where: {
          schoolId_idempotencyKey: {
            schoolId: user.schoolId,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          success: true,
          receiptNo: existing.receiptNo,
          receiptData: await buildReceiptData(
            prisma,
            { id: existing.id },
            user.name,
          ),
        };
      }
    }

    // 0. Fetch school fee policy
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        feePaymentMode: true,
        minPartialPaymentPercentage: true,
        minPartialPaymentAmount: true,
        timezone: true,
      },
    });
    const timeZone = resolveTimeZone(school?.timezone);
    const today = todayInTimeZone(timeZone);

    const feePaymentMode = school?.feePaymentMode || "ALLOW_PARTIAL";
    const minPartialPaymentPercentage = Number(
      school?.minPartialPaymentPercentage || 0,
    );
    const minPartialPaymentAmount = Number(
      school?.minPartialPaymentAmount || 0,
    );

    const result = await prisma.$transaction(
      async (tx) => {
        // Verify student belongs to this school
        const student = await tx.student.findFirst({
          where: { id: data.studentId, schoolId: user.schoolId },
        });
        if (!student) {
          throw new Error("Student not found in your school");
        }

        // B4/B5: sequential per-school receipt number. This also locks the
        // school row until commit, so concurrent payments for the school run
        // one at a time and the balance reads below are never stale.
        const receiptNo = await allocateReceiptNumber(
          tx,
          user.schoolId,
          timeZone,
        );

        // 1. Create Payment Transaction
        const payment = await tx.paymentTransaction.create({
          data: {
            schoolId: user.schoolId,
            studentId: data.studentId,
            amount: totalPayment,
            method: data.method,
            reference: data.reference,
            receiptNo,
            idempotencyKey: data.idempotencyKey || null,
            remarks: data.remarks,
            status: "SUCCESS",
          },
        });

        const allocationsCreated: {
          paymentId: string;
          chargeItemId: string;
          amount: number;
        }[] = [];
        const affectedChargeIds = new Set<string>();

        /**
         * B9: a month paid less than its due must respect the school's
         * policy. Used for month totals and (U10) for item amounts, summed
         * per month.
         */
        const assertMonthPolicy = (
          chargeTitle: string,
          totalChargeBilled: number,
          totalChargeDue: number,
          enteredAmount: number,
        ) => {
          if (enteredAmount < totalChargeDue) {
            if (feePaymentMode === "FULL_ONLY") {
              throw new Error(
                `Payment failed: School policy requires clearing the full monthly due of ₹${totalChargeDue.toFixed(2)} for ${chargeTitle}. Partial payments are disabled.`,
              );
            } else if (feePaymentMode === "ALLOW_PARTIAL") {
              let minRequired = 0;
              if (minPartialPaymentPercentage > 0) {
                minRequired = roundMoney(
                  (totalChargeBilled * minPartialPaymentPercentage) / 100,
                );
              } else if (minPartialPaymentAmount > 0) {
                minRequired = minPartialPaymentAmount;
              }

              if (minRequired > 0 && totalChargeDue <= minRequired) {
                throw new Error(
                  `Payment failed: The remaining due for ${chargeTitle} is ₹${totalChargeDue.toFixed(2)}, which is at or below the minimum partial threshold (${minPartialPaymentPercentage > 0 ? `${minPartialPaymentPercentage}% (₹${minRequired})` : `₹${minRequired}`}). The remaining balance must be cleared in full.`,
                );
              } else if (minRequired > 0 && enteredAmount < minRequired) {
                throw new Error(
                  `Payment failed: Minimum partial payment for ${chargeTitle} is ${minPartialPaymentPercentage > 0 ? `${minPartialPaymentPercentage}% of total fee (₹${minRequired.toFixed(2)})` : `₹${minRequired.toFixed(2)}`}.`,
                );
              }
            }
          }
        };

        // 2. Allocate Month-wise payments if provided (FIFO: oldest due date first)
        if (data.monthPayments && data.monthPayments.length > 0) {
          const charges = await tx.feeCharge.findMany({
            where: {
              id: { in: data.monthPayments.map((m) => m.chargeId) },
              schoolId: user.schoolId,
              studentId: data.studentId,
            },
            include: {
              items: {
                include: { component: true },
                // U10: the order the collection screens preview.
                orderBy: { id: "asc" },
              },
            },
          });
          const chargeMap = new Map(charges.map((c) => [c.id, c]));

          const sortedMonthPayments = [...data.monthPayments].sort((a, b) => {
            const dateA = chargeMap.get(a.chargeId)?.dueDate
              ? new Date(chargeMap.get(a.chargeId)!.dueDate).getTime()
              : 0;
            const dateB = chargeMap.get(b.chargeId)?.dueDate
              ? new Date(chargeMap.get(b.chargeId)!.dueDate).getTime()
              : 0;
            return dateA - dateB;
          });

          for (const mp of sortedMonthPayments) {
            const enteredAmount = roundMoney(mp.amount);
            if (enteredAmount <= 0) continue;

            // B7: Fail closed if charge not found
            const charge = chargeMap.get(mp.chargeId);

            if (!charge) {
              throw new Error(
                `Charge ${mp.chargeId} not found for student in your school`,
              );
            }

            // Calculate total billed amount and remaining due for this charge
            let totalChargeBilled = 0;
            let totalChargeDue = 0;

            for (const it of charge.items) {
              if (it.status === FeeStatus.WAIVED) continue;
              const amt = roundMoney(Number(it.amount || 0));
              const paid = roundMoney(Number(it.paidAmount || 0));
              totalChargeBilled = roundMoney(totalChargeBilled + amt);
              totalChargeDue = roundMoney(
                totalChargeDue + Math.max(0, roundMoney(amt - paid)),
              );
            }

            // B9: Policy Enforcements
            assertMonthPolicy(
              charge.title,
              totalChargeBilled,
              totalChargeDue,
              enteredAmount,
            );

            // Distribute entered amount across unpaid charge items
            let remainingForCharge = enteredAmount;
            const eligibleItems = charge.items.filter(
              (it) => it.status !== FeeStatus.WAIVED,
            );

            for (const item of eligibleItems) {
              if (remainingForCharge <= 0) break;
              const itemDue = roundMoney(
                Math.max(0, Number(item.amount) - Number(item.paidAmount)),
              );
              if (itemDue <= 0) continue;

              const allocAmount = roundMoney(
                Math.min(itemDue, remainingForCharge),
              );
              allocationsCreated.push({
                paymentId: payment.id,
                chargeItemId: item.id,
                amount: allocAmount,
              });

              remainingForCharge = roundMoney(remainingForCharge - allocAmount);

              const currentPaid = roundMoney(Number(item.paidAmount));
              const originalAmt = roundMoney(Number(item.amount));
              const updatedPaid = roundMoney(currentPaid + allocAmount);
              if (updatedPaid > originalAmt + 0.001) {
                throw new Error(`Overpayment detected on fee item ${item.id}`);
              }
              const newItemStatus =
                updatedPaid >= originalAmt ? FeeStatus.PAID : FeeStatus.PARTIAL;

              // Combined atomic increment and status update (1 query instead of 2)
              await tx.feeChargeItem.update({
                where: { id: item.id },
                data: {
                  paidAmount: { increment: allocAmount },
                  status: newItemStatus,
                },
              });
            }

            affectedChargeIds.add(charge.id);

            // True surplus (paid more than total month due) goes to advance
            if (remainingForCharge > 0) {
              await tx.advanceLedger.create({
                data: {
                  studentId: data.studentId,
                  amount: remainingForCharge,
                  description: `Surplus Advance from payment ${receiptNo} for ${charge.title}`,
                },
              });
            }
          }
        }

        // 3. Allocate item-wise payments if provided
        if (data.itemPayments && data.itemPayments.length > 0) {
          const itemIds = data.itemPayments.map((ip) => ip.chargeItemId);
          const foundItems = await tx.feeChargeItem.findMany({
            where: {
              id: { in: itemIds },
              charge: {
                schoolId: user.schoolId,
                studentId: data.studentId,
              },
            },
            include: { charge: { include: { items: true } } },
          });
          const itemsMap = new Map(foundItems.map((it) => [it.id, it]));

          // U10: the screens send a month item by item when staff choose the
          // split, so the month policy applies to each month's total here.
          const enteredByCharge = new Map<string, number>();
          for (const ip of data.itemPayments) {
            const item = itemsMap.get(ip.chargeItemId);
            if (!item) continue; // Rejected below.
            enteredByCharge.set(
              item.chargeId,
              roundMoney((enteredByCharge.get(item.chargeId) ?? 0) + ip.amount),
            );
          }
          for (const [chargeId, entered] of enteredByCharge) {
            const charge = foundItems.find(
              (it) => it.chargeId === chargeId,
            )!.charge;
            let billed = 0;
            let due = 0;
            for (const it of charge.items) {
              if (it.status === FeeStatus.WAIVED) continue;
              const amt = roundMoney(Number(it.amount || 0));
              billed = roundMoney(billed + amt);
              due = roundMoney(
                due + Math.max(0, roundMoney(amt - Number(it.paidAmount || 0))),
              );
            }
            assertMonthPolicy(charge.title, billed, due, entered);
          }

          for (const ip of data.itemPayments) {
            const itemAmount = roundMoney(ip.amount);
            if (itemAmount <= 0) continue;

            // B7: Fail closed if item not found
            const item = itemsMap.get(ip.chargeItemId);

            if (!item) {
              throw new Error(
                `Fee charge item ${ip.chargeItemId} not found for student in your school`,
              );
            }

            // B9: Reject allocation to waived items
            if (item.status === FeeStatus.WAIVED) {
              throw new Error(
                `Fee charge item ${ip.chargeItemId} has been waived and cannot be paid`,
              );
            }

            const due = roundMoney(
              Math.max(0, Number(item.amount) - Number(item.paidAmount)),
            );

            // B9: Policy check for item payments
            if (feePaymentMode === "FULL_ONLY" && itemAmount < due) {
              throw new Error(
                `Payment failed: School policy requires clearing full item due of ₹${due.toFixed(2)}. Partial payments are disabled.`,
              );
            }

            const allocAmount = roundMoney(Math.min(due, itemAmount));
            const surplus = roundMoney(Math.max(0, itemAmount - due));

            if (allocAmount > 0) {
              allocationsCreated.push({
                paymentId: payment.id,
                chargeItemId: item.id,
                amount: allocAmount,
              });

              const currentPaid = roundMoney(Number(item.paidAmount));
              const originalAmt = roundMoney(Number(item.amount));
              const updatedPaid = roundMoney(currentPaid + allocAmount);
              if (updatedPaid > originalAmt + 0.001) {
                throw new Error(`Overpayment detected on fee item ${item.id}`);
              }
              const newItemStatus =
                updatedPaid >= originalAmt ? FeeStatus.PAID : FeeStatus.PARTIAL;

              // Combined atomic increment and status update (1 query instead of 2)
              await tx.feeChargeItem.update({
                where: { id: item.id },
                data: {
                  paidAmount: { increment: allocAmount },
                  status: newItemStatus,
                },
              });

              affectedChargeIds.add(item.chargeId);
            }

            if (surplus > 0) {
              await tx.advanceLedger.create({
                data: {
                  studentId: data.studentId,
                  componentId: item.componentId || null,
                  amount: surplus,
                  description: `Surplus Advance from payment ${receiptNo} for ${item.charge.title}`,
                },
              });
            }
          }
        }

        // 4. Allocate component-wise payments if provided
        if (data.componentPayments && data.componentPayments.length > 0) {
          const compIds = data.componentPayments.map((cp) => cp.componentId);
          const foundComps = await tx.feeComponent.findMany({
            where: { id: { in: compIds }, schoolId: user.schoolId },
          });
          const compMap = new Map(foundComps.map((c) => [c.id, c]));

          for (const cp of data.componentPayments) {
            const compAmount = roundMoney(cp.amount);
            if (compAmount <= 0) continue;

            // B7: Verify component exists
            const comp = compMap.get(cp.componentId);
            if (!comp) {
              throw new Error(
                `Fee component ${cp.componentId} not found in your school`,
              );
            }

            let remainingAmount = compAmount;

            // Find all outstanding FeeChargeItems for this student and component (excluding WAIVED)
            const items = await tx.feeChargeItem.findMany({
              where: {
                componentId: cp.componentId,
                status: {
                  in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE],
                },
                charge: {
                  schoolId: user.schoolId,
                  studentId: data.studentId,
                },
              },
              include: { charge: true },
              orderBy: { charge: { dueDate: "asc" } },
            });

            // B9: Policy check for component payments
            if (feePaymentMode === "FULL_ONLY") {
              const compTotalDue = roundMoney(
                items.reduce(
                  (s, it) =>
                    s + Math.max(0, Number(it.amount) - Number(it.paidAmount)),
                  0,
                ),
              );
              if (remainingAmount < compTotalDue) {
                throw new Error(
                  `Payment failed: School policy requires clearing full component balance of ₹${compTotalDue.toFixed(2)}. Partial payments are disabled.`,
                );
              }
            }

            for (const item of items) {
              if (remainingAmount <= 0) break;

              const due = roundMoney(
                Math.max(0, Number(item.amount) - Number(item.paidAmount)),
              );
              if (due > 0) {
                const allocAmount = roundMoney(Math.min(due, remainingAmount));

                allocationsCreated.push({
                  paymentId: payment.id,
                  chargeItemId: item.id,
                  amount: allocAmount,
                });

                remainingAmount = roundMoney(remainingAmount - allocAmount);

                const currentPaid = roundMoney(Number(item.paidAmount));
                const originalAmt = roundMoney(Number(item.amount));
                const updatedPaid = roundMoney(currentPaid + allocAmount);
                if (updatedPaid > originalAmt + 0.001) {
                  throw new Error(
                    `Overpayment detected on fee item ${item.id}`,
                  );
                }
                const newItemStatus =
                  updatedPaid >= originalAmt
                    ? FeeStatus.PAID
                    : FeeStatus.PARTIAL;

                // Combined atomic increment and status update
                await tx.feeChargeItem.update({
                  where: { id: item.id },
                  data: {
                    paidAmount: { increment: allocAmount },
                    status: newItemStatus,
                  },
                });

                affectedChargeIds.add(item.chargeId);
              }
            }

            // Create component-specific advance if there's remaining surplus
            if (remainingAmount > 0) {
              await tx.advanceLedger.create({
                data: {
                  studentId: data.studentId,
                  componentId: cp.componentId,
                  amount: remainingAmount,
                  description: `Component Advance from payment ${receiptNo}`,
                },
              });
            }
          }
        }

        // 5. Create General Advance if explicitly provided
        if (data.generalAdvanceAmount && data.generalAdvanceAmount > 0) {
          await tx.advanceLedger.create({
            data: {
              studentId: data.studentId,
              amount: roundMoney(data.generalAdvanceAmount),
              description: `General Advance from payment ${receiptNo}`,
            },
          });
        }

        // 6. Create Allocations
        if (allocationsCreated.length > 0) {
          await tx.paymentAllocation.createMany({
            data: allocationsCreated,
          });
        }

        // 7. Update parent charge statuses
        for (const chargeId of Array.from(affectedChargeIds)) {
          await recomputeChargeStatus(tx, chargeId, today);
        }

        // B12: freeze the receipt as of this payment so reprints never change
        const receiptData = await buildReceiptData(
          tx,
          { id: payment.id },
          user.name,
        );
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: { receiptSnapshot: receiptData as any },
        });

        return {
          paymentId: payment.id,
          receiptNo,
          allocations: allocationsCreated,
          receiptData,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );

    revalidatePath("/fees");
    revalidatePath(`/students/${data.studentId}`);
    revalidatePath("/dashboard");
    await Promise.all([
      invalidateFeesCache(user.schoolId),
      invalidateCache(
        `cache:${user.schoolId}:students:details:${data.studentId}`,
      ),
    ]);

    return {
      success: true,
      receiptNo: result.receiptNo,
      allocations: result.allocations,
      receiptData: result.receiptData,
    };
  } catch (e: any) {
    // A concurrent submit with the same key won the race: return its receipt.
    if (data.idempotencyKey && isIdempotencyConflict(e)) {
      const existing = await prisma.paymentTransaction.findUnique({
        where: {
          schoolId_idempotencyKey: {
            schoolId: user.schoolId,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          success: true,
          receiptNo: existing.receiptNo,
          receiptData: await buildReceiptData(
            prisma,
            { id: existing.id },
            user.name,
          ),
        };
      }
    }
    return { error: actionErrorMessage(e) };
  }
}

/**
 * Builds a payment's receipt from the current state of its charges. Called
 * inside the payment transaction to produce the stored snapshot, and as a
 * fallback for receipts issued before snapshots existed.
 */
async function buildReceiptData(
  db: Prisma.TransactionClient,
  where: { id: string },
  generatedByName?: string | null,
): Promise<FeeReceiptData> {
  const payment = await db.paymentTransaction.findUniqueOrThrow({
    where,
    include: {
      school: true,
      student: {
        include: {
          class: true,
          section: true,
        },
      },
      allocations: {
        include: {
          chargeItem: {
            include: {
              component: true,
              charge: {
                include: {
                  items: {
                    include: { component: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const school = payment.school;
  const addressParts = [
    school.address,
    school.city,
    school.state,
    school.pincode,
  ].filter(Boolean);
  const schoolAddress = addressParts.join(", ") || "School Campus";
  const contactParts = [school.email, school.phone].filter(Boolean);
  const schoolContact = contactParts.join(" | ") || "";

  const student = payment.student;
  const regNo = student.admissionNumber || student.rollNumber || "N/A";
  const className = `${student.class?.name || "NUR"}-${student.section?.name || "None"}`;

  // B12: show the time in the school's time zone, not the server's
  const timestamp = formatDateTimeInTimeZone(
    new Date(payment.createdAt || payment.date),
    school.timezone,
  );

  const monthsSet = new Set<string>();
  const chargesMap = new Map<string, any>();

  for (const alloc of payment.allocations) {
    const charge = alloc.chargeItem?.charge;
    if (charge) {
      monthsSet.add(charge.title);
      if (!chargesMap.has(charge.id)) {
        chargesMap.set(charge.id, charge);
      }
    }
  }

  const monthCount =
    chargesMap.size > 0
      ? chargesMap.size
      : monthsSet.size > 0
        ? monthsSet.size
        : 1;

  // Helper to detect late fee components
  const isLateFeeComp = (item: any) =>
    item?.component?.category === "LATE_FEE" ||
    item?.component?.name?.toLowerCase().includes("late");

  // Extract actual 1-month rate/price for each unique component
  const regularHeadMap = new Map<string, number>();
  let totalLateFeeAcrossCharges = 0;
  let singleLateFeeRate = 0;

  if (chargesMap.size > 0) {
    chargesMap.forEach((charge) => {
      charge.items?.forEach((it: any) => {
        if (it.status === FeeStatus.WAIVED) return;
        const compName = it.component?.name || "Fee";
        const compAmount = Number(it.amount || 0);

        if (isLateFeeComp(it)) {
          totalLateFeeAcrossCharges = roundMoney(
            totalLateFeeAcrossCharges + compAmount,
          );
          if (singleLateFeeRate === 0 && compAmount > 0) {
            singleLateFeeRate = compAmount;
          }
        } else {
          if (!regularHeadMap.has(compName) && compAmount > 0) {
            regularHeadMap.set(compName, compAmount);
          }
        }
      });
    });
  }

  // Fallback: If no charge structure linked, inspect allocations
  if (regularHeadMap.size === 0) {
    for (const alloc of payment.allocations) {
      const item = alloc.chargeItem;
      const compName = item?.component?.name || "Fee";
      const compAmount = Number(item?.amount || alloc.amount || 0);

      if (isLateFeeComp(item)) {
        totalLateFeeAcrossCharges = roundMoney(
          totalLateFeeAcrossCharges + Number(alloc.amount || 0),
        );
        if (singleLateFeeRate === 0) singleLateFeeRate = compAmount;
      } else {
        if (!regularHeadMap.has(compName) && compAmount > 0) {
          regularHeadMap.set(compName, compAmount);
        }
      }
    }
  }

  const items: FeeReceiptItem[] = [];
  regularHeadMap.forEach((oneMonthAmt, head) => {
    items.push({
      head,
      amount: oneMonthAmt,
    });
  });

  if (totalLateFeeAcrossCharges > 0) {
    items.push({
      head: "Late Fine / Overdue Penalty",
      amount:
        singleLateFeeRate > 0 ? singleLateFeeRate : totalLateFeeAcrossCharges,
    });
  }

  const txAmount = Number(payment.amount || 0);
  if (items.length === 0 && txAmount > 0) {
    items.push({
      head: "Fee Payment",
      amount: txAmount,
    });
  }

  const monthsList = Array.from(monthsSet);
  let paidForMonths = "General Account";
  if (monthsList.length === 1) {
    paidForMonths = monthsList[0];
  } else if (monthsList.length > 1) {
    paidForMonths = `${monthsList[0]} - ${monthsList[monthsList.length - 1]} (${monthsList.length} Months)`;
  }

  const methodStr = (payment.method || "CASH").replace(/_/g, " ");
  const paymentType = payment.reference
    ? `${methodStr} (${payment.reference})`
    : methodStr;

  const generatedBy = generatedByName || "School Administration";

  // Determine if this payment leaves dues or clears the month
  let monthTotalBilled = 0;
  let monthTotalPaid = 0;
  let monthRemainingDue = 0;
  let isPartial = false;

  if (chargesMap.size > 0) {
    chargesMap.forEach((charge) => {
      let chargeBilled = 0;
      let chargePaid = 0;
      charge.items?.forEach((it: any) => {
        if (it.status !== FeeStatus.WAIVED) {
          const amt = Number(it.amount || 0);
          const pd = Number(it.paidAmount || 0);
          chargeBilled = roundMoney(chargeBilled + amt);
          chargePaid = roundMoney(chargePaid + pd);
        }
      });
      monthTotalBilled = roundMoney(monthTotalBilled + chargeBilled);
      monthTotalPaid = roundMoney(monthTotalPaid + chargePaid);
      const due = roundMoney(Math.max(0, chargeBilled - chargePaid));
      monthRemainingDue = roundMoney(monthRemainingDue + due);
      if (due > 0 || charge.status !== FeeStatus.PAID) {
        isPartial = true;
      }
    });
  }

  // Build granular month-by-month allocation breakdown
  const monthAllocations: FeeReceiptMonthAllocation[] = [];
  let outstandingBefore = 0;

  const sortedCharges = Array.from(chargesMap.values()).sort(
    (a: any, b: any) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  sortedCharges.forEach((charge: any) => {
    let feeDue = 0;
    let totalPaidSoFar = 0;

    charge.items?.forEach((it: any) => {
      if (it.status !== FeeStatus.WAIVED) {
        feeDue = roundMoney(feeDue + Number(it.amount || 0));
        totalPaidSoFar = roundMoney(
          totalPaidSoFar + Number(it.paidAmount || 0),
        );
      }
    });

    const paidNow = roundMoney(
      payment.allocations
        .filter((a: any) => a.chargeItem?.chargeId === charge.id)
        .reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0),
    );

    const previouslyPaid = roundMoney(Math.max(0, totalPaidSoFar - paidNow));
    const balanceDue = roundMoney(Math.max(0, feeDue - totalPaidSoFar));
    const status: "PAID" | "PARTIALLY PAID" | "UNPAID" =
      balanceDue <= 0
        ? "PAID"
        : previouslyPaid + paidNow > 0
          ? "PARTIALLY PAID"
          : "UNPAID";
    const coveragePercent =
      feeDue > 0
        ? Math.round(((previouslyPaid + paidNow) / feeDue) * 100)
        : 100;

    outstandingBefore = roundMoney(outstandingBefore + feeDue - previouslyPaid);

    monthAllocations.push({
      chargeId: charge.id,
      month: charge.title,
      dueDate: charge.dueDate,
      feeDue,
      previouslyPaid,
      paidNow,
      balanceDue,
      status,
      coveragePercent,
    });
  });

  const totalAllocatedToCharges = roundMoney(
    monthAllocations.reduce((sum, m) => sum + m.paidNow, 0),
  );
  // What the months still owe after this payment, before the advance line.
  const remainingOutstanding = roundMoney(
    monthAllocations.reduce((sum, m) => sum + m.balanceDue, 0),
  );
  const advanceSurplus = roundMoney(
    Math.max(0, txAmount - totalAllocatedToCharges),
  );
  if (advanceSurplus > 0) {
    monthAllocations.push({
      chargeId: "advance-deposit",
      month: "Advance / Prepaid Balance Deposit",
      feeDue: advanceSurplus,
      previouslyPaid: 0,
      paidNow: advanceSurplus,
      balanceDue: 0,
      status: "PAID",
      coveragePercent: 100,
    });
  }

  if (outstandingBefore === 0) {
    outstandingBefore = txAmount;
  }

  const paymentStatus: "PAID_IN_FULL" | "PARTIAL_PAYMENT" =
    remainingOutstanding <= 0 ? "PAID_IN_FULL" : "PARTIAL_PAYMENT";
  const paymentStatusText =
    remainingOutstanding <= 0
      ? "PAID IN FULL"
      : `PARTIAL PAYMENT — ₹${remainingOutstanding.toLocaleString("en-IN")} DUE`;

  const documentType = isPartial ? "PARTIAL_INVOICE" : "OFFICIAL_RECEIPT";

  const data: FeeReceiptData = {
    schoolName: school?.name || "School",
    schoolAddress,
    schoolContact,
    timestamp,
    receiptNo: payment.receiptNo,
    regNo,
    rollNumber: student.rollNumber || "-",
    studentName: student.name,
    className,
    items,
    total: monthTotalBilled > 0 ? monthTotalBilled : txAmount,
    amountPaid: txAmount,
    paidForMonths,
    paymentType,
    generatedBy,
    isPartial,
    documentType,
    monthTotalBilled: monthTotalBilled > 0 ? monthTotalBilled : txAmount,
    monthTotalPaid: monthTotalPaid > 0 ? monthTotalPaid : txAmount,
    monthRemainingDue: remainingOutstanding,
    outstandingBefore,
    remainingOutstanding,
    paymentStatus,
    paymentStatusText,
    monthAllocations,
    monthCount,
    lateFeeTotal: totalLateFeeAcrossCharges,
  };

  return data;
}

export async function getFeeReceiptDetails(
  receiptNo: string,
): Promise<{ success: boolean; data?: FeeReceiptData; error?: string }> {
  const user = await getFinanceSession("view");
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const payment = await prisma.paymentTransaction.findFirst({
      where: { receiptNo, schoolId: user.schoolId },
      select: { id: true, receiptSnapshot: true },
    });
    if (!payment) return { success: false, error: "Receipt not found" };

    // B12: receipts are frozen at payment time
    if (payment.receiptSnapshot) {
      return {
        success: true,
        data: payment.receiptSnapshot as unknown as FeeReceiptData,
      };
    }

    // Older receipts have no snapshot. Rebuild them from current data but
    // don't store the result: it would freeze today's balances as history.
    return {
      success: true,
      data: await buildReceiptData(prisma, { id: payment.id }, user.name),
    };
  } catch (e: any) {
    return {
      success: false,
      error: actionErrorMessage(e, "Failed to load receipt details"),
    };
  }
}

/** B10: Waives what is still owed on a fee item (see `waiveChargeItemInTx`). */
export async function waiveFeeChargeItem(itemId: string, waiverReason: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const reason = (waiverReason ?? "").trim();
  if (reason.length < 3) {
    return { error: "Enter a reason for the waiver (at least 3 characters)" };
  }
  if (reason.length > 500) {
    return { error: "Waiver reason must be at most 500 characters" };
  }

  try {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { timezone: true },
    });
    const today = todayInTimeZone(school?.timezone);

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.feeChargeItem.findFirst({
        where: {
          id: itemId,
          charge: { schoolId: user.schoolId },
        },
        include: {
          charge: true,
          component: true,
        },
      });

      if (!item) {
        throw new Error("Fee charge item not found in your school");
      }

      await waiveChargeItemInTx(tx, item, user.id, reason);
      await recomputeChargeStatus(tx, item.chargeId, today);

      return { studentId: item.charge.studentId };
    });

    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${result.studentId}`);
    await Promise.all([
      invalidateFeesCache(user.schoolId),
      invalidateCache(
        `cache:${user.schoolId}:students:details:${result.studentId}`,
      ),
    ]);
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

// B11: Side-effect-free student fee dues query
export async function getStudentFeeDues(studentId: string) {
  const user = await getFinanceSession("view");
  if (!user) return { error: "Unauthorized" };

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId, schoolId: user.schoolId },
      include: {
        school: {
          select: {
            feePaymentMode: true,
            minPartialPaymentPercentage: true,
            minPartialPaymentAmount: true,
          },
        },
        advanceLedgers: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        transports: {
          where: { status: "ACTIVE" },
          include: {
            route: { select: { name: true } },
            stop: { select: { stopName: true, distanceFromSchoolKm: true } },
            vehicle: { select: { registrationNo: true } },
          },
        },
      },
    });

    if (!student) return { error: "Student not found" };

    const charges = await prisma.feeCharge.findMany({
      where: {
        studentId,
        schoolId: user.schoolId,
        status: {
          in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE],
        },
      },
      include: {
        items: {
          include: {
            component: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const recentTransactions = await prisma.paymentTransaction.findMany({
      where: {
        studentId,
        schoolId: user.schoolId,
      },
      include: {
        allocations: {
          include: {
            chargeItem: {
              include: {
                component: true,
                charge: true,
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 10,
    });

    return {
      success: true,
      student,
      charges,
      recentTransactions,
    };
  } catch (e: any) {
    return { error: actionErrorMessage(e, "Failed to fetch student fee dues") };
  }
}
