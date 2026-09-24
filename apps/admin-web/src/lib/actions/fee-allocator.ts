"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeStatus, PaymentMethod } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { invalidateFeesCache, invalidateCache } from "@/lib/redis";

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role))
    return null;
  return { ...user, schoolId: user.schoolId };
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

  // New Summary & Allocation Fields
  outstandingBefore: number;
  remainingOutstanding: number;
  paymentStatus: "PAID_IN_FULL" | "PARTIAL_PAYMENT";
  paymentStatusText: string;
  monthAllocations: FeeReceiptMonthAllocation[];

  // Multi-month and late fee metadata
  monthCount?: number;
  lateFeeTotal?: number;
}

export async function allocatePayment(data: {
  studentId: string;
  monthPayments?: { chargeId: string; amount: number }[];
  itemPayments?: { chargeItemId: string; amount: number }[];
  componentPayments?: { componentId: string; amount: number }[];
  generalAdvanceAmount?: number;
  method: PaymentMethod;
  reference?: string;
  remarks?: string;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const monthTotal = (data.monthPayments || []).reduce(
    (sum, mp) => sum + (Number(mp.amount) || 0),
    0,
  );
  const itemTotal = (data.itemPayments || []).reduce(
    (sum, ip) => sum + (Number(ip.amount) || 0),
    0,
  );
  const componentTotal = (data.componentPayments || []).reduce(
    (sum, cp) => sum + (Number(cp.amount) || 0),
    0,
  );
  const totalPayment =
    monthTotal +
    itemTotal +
    componentTotal +
    (Number(data.generalAdvanceAmount) || 0);

  if (totalPayment <= 0)
    return { error: "Payment amount must be greater than zero." };

  try {
    // 0. Fetch school fee policy
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        feePaymentMode: true,
        minPartialPaymentPercentage: true,
        minPartialPaymentAmount: true,
      },
    });

    const feePaymentMode = school?.feePaymentMode || "ALLOW_PARTIAL";
    const minPartialPaymentPercentage = Number(
      school?.minPartialPaymentPercentage || 0,
    );
    const minPartialPaymentAmount = Number(
      school?.minPartialPaymentAmount || 0,
    );

    const receiptNo = `RCP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create Payment Transaction
        const payment = await tx.paymentTransaction.create({
          data: {
            schoolId: user.schoolId,
            studentId: data.studentId,
            amount: totalPayment,
            method: data.method,
            reference: data.reference,
            receiptNo,
            remarks: data.remarks,
            status: "SUCCESS",
          },
        });

        const allocationsCreated = [];
        const affectedChargeIds = new Set<string>();

        // 2. Allocate Month-wise payments if provided (FIFO: oldest due date first)
        if (data.monthPayments && data.monthPayments.length > 0) {
          const chargeDates = await tx.feeCharge.findMany({
            where: { id: { in: data.monthPayments.map((m) => m.chargeId) } },
            select: { id: true, dueDate: true },
          });
          const chargeDateMap = new Map<string, number>();
          chargeDates.forEach((c) =>
            chargeDateMap.set(c.id, new Date(c.dueDate).getTime() || 0),
          );

          const sortedMonthPayments = [...data.monthPayments].sort((a, b) => {
            return (
              (chargeDateMap.get(a.chargeId) || 0) -
              (chargeDateMap.get(b.chargeId) || 0)
            );
          });

          for (const mp of sortedMonthPayments) {
            const enteredAmount = Number(mp.amount) || 0;
            if (enteredAmount <= 0) continue;

            const charge = await tx.feeCharge.findUnique({
              where: { id: mp.chargeId },
              include: {
                items: {
                  include: { component: true },
                },
              },
            });

            if (!charge || charge.studentId !== data.studentId) continue;

            // Calculate total billed amount and remaining due for this charge
            let totalChargeBilled = 0;
            let totalChargeDue = 0;

            for (const it of charge.items) {
              if (it.status === "WAIVED") continue;
              const amt = Number(it.amount || 0);
              const paid = Number(it.paidAmount || 0);
              totalChargeBilled += amt;
              totalChargeDue += Math.max(0, amt - paid);
            }

            // Policy Enforcements
            if (enteredAmount < totalChargeDue) {
              if (feePaymentMode === "FULL_ONLY") {
                throw new Error(
                  `Payment failed: School policy requires clearing the full monthly due of ₹${totalChargeDue.toFixed(2)} for ${charge.title}. Partial payments are disabled.`,
                );
              } else if (feePaymentMode === "ALLOW_PARTIAL") {
                // Calculate minimum installment threshold based on the month's total billed charge
                let minRequired = 0;
                if (minPartialPaymentPercentage > 0) {
                  minRequired = Math.ceil(
                    (totalChargeBilled * minPartialPaymentPercentage) / 100,
                  );
                } else if (minPartialPaymentAmount > 0) {
                  minRequired = minPartialPaymentAmount;
                }

                // LOOPHOLE PREVENTION:
                // If remaining due is already <= minRequired threshold (e.g. ₹200 left on a ₹1,000 charge where min 80% is ₹800),
                // the student CANNOT pay a fraction of the remaining ₹200; they must clear it in full!
                if (minRequired > 0 && totalChargeDue <= minRequired) {
                  throw new Error(
                    `Payment failed: The remaining due for ${charge.title} is ₹${totalChargeDue.toFixed(2)}, which is at or below the minimum partial threshold (${minPartialPaymentPercentage > 0 ? `${minPartialPaymentPercentage}% (₹${minRequired})` : `₹${minRequired}`}). The remaining balance must be cleared in full.`,
                  );
                } else if (minRequired > 0 && enteredAmount < minRequired) {
                  throw new Error(
                    `Payment failed: Minimum partial payment for ${charge.title} is ${minPartialPaymentPercentage > 0 ? `${minPartialPaymentPercentage}% of total fee (₹${minRequired.toFixed(2)})` : `₹${minRequired.toFixed(2)}`}.`,
                  );
                }
              }
            }

            // Distribute entered amount across unpaid charge items
            let remainingForCharge = enteredAmount;
            const eligibleItems = charge.items.filter(
              (it) => it.status !== "WAIVED",
            );

            for (const item of eligibleItems) {
              if (remainingForCharge <= 0) break;
              const itemDue = Math.max(
                0,
                Number(item.amount) - Number(item.paidAmount),
              );
              if (itemDue <= 0) continue;

              const allocAmount = Math.min(itemDue, remainingForCharge);
              allocationsCreated.push({
                paymentId: payment.id,
                chargeItemId: item.id,
                amount: allocAmount,
              });

              remainingForCharge -= allocAmount;

              const newPaidAmount = Number(item.paidAmount) + allocAmount;
              const newItemStatus =
                newPaidAmount >= Number(item.amount)
                  ? FeeStatus.PAID
                  : FeeStatus.PARTIAL;

              await tx.feeChargeItem.update({
                where: { id: item.id },
                data: { paidAmount: newPaidAmount, status: newItemStatus },
              });
            }

            affectedChargeIds.add(charge.id);

            // True surplus (paid more than the total month due) goes to advance
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
          for (const ip of data.itemPayments) {
            const itemAmount = Number(ip.amount) || 0;
            if (itemAmount <= 0) continue;

            const item = await tx.feeChargeItem.findUnique({
              where: { id: ip.chargeItemId },
              include: { charge: true },
            });

            if (!item || item.charge.studentId !== data.studentId) continue;

            const due = Number(item.amount) - Number(item.paidAmount);
            const allocAmount = Math.min(due, itemAmount);
            const surplus = Math.max(0, itemAmount - due);

            if (allocAmount > 0) {
              allocationsCreated.push({
                paymentId: payment.id,
                chargeItemId: item.id,
                amount: allocAmount,
              });

              const newPaidAmount = Number(item.paidAmount) + allocAmount;
              const newItemStatus =
                newPaidAmount >= Number(item.amount)
                  ? FeeStatus.PAID
                  : FeeStatus.PARTIAL;

              await tx.feeChargeItem.update({
                where: { id: item.id },
                data: { paidAmount: newPaidAmount, status: newItemStatus },
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
          for (const cp of data.componentPayments) {
            if (cp.amount <= 0) continue;

            let remainingAmount = cp.amount;

            // Find all outstanding FeeChargeItems for this student and component
            const items = await tx.feeChargeItem.findMany({
              where: {
                componentId: cp.componentId,
                status: {
                  in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE],
                },
                charge: { studentId: data.studentId },
              },
              include: { charge: true },
              orderBy: { charge: { dueDate: "asc" } },
            });

            for (const item of items) {
              if (remainingAmount <= 0) break;

              const due = Number(item.amount) - Number(item.paidAmount);
              if (due > 0) {
                const allocAmount = Math.min(due, remainingAmount);

                allocationsCreated.push({
                  paymentId: payment.id,
                  chargeItemId: item.id,
                  amount: allocAmount,
                });

                remainingAmount -= allocAmount;

                // Update item status
                const newPaidAmount = Number(item.paidAmount) + allocAmount;
                const newItemStatus =
                  newPaidAmount >= Number(item.amount)
                    ? FeeStatus.PAID
                    : FeeStatus.PARTIAL;

                await tx.feeChargeItem.update({
                  where: { id: item.id },
                  data: { paidAmount: newPaidAmount, status: newItemStatus },
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
              amount: data.generalAdvanceAmount,
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

        // 7. Update Parent Charge Statuses
        for (const chargeId of Array.from(affectedChargeIds)) {
          const items = await tx.feeChargeItem.findMany({
            where: { chargeId },
          });

          let allPaid = true;
          let anyPaid = false;

          for (const item of items) {
            if (item.status !== "PAID" && item.status !== "WAIVED")
              allPaid = false;
            if (item.status === "PAID" || item.status === "PARTIAL")
              anyPaid = true;
          }

          let newChargeStatus: FeeStatus = FeeStatus.PENDING;
          if (allPaid) newChargeStatus = FeeStatus.PAID;
          else if (anyPaid) newChargeStatus = FeeStatus.PARTIAL;

          await tx.feeCharge.update({
            where: { id: chargeId },
            data: { status: newChargeStatus },
          });
        }

        return { receiptNo, allocations: allocationsCreated };
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

    // Fetch formatted receipt data directly for immediate preview & print
    const receiptRes = await getFeeReceiptDetails(receiptNo);

    return {
      success: true,
      ...result,
      receiptData: receiptRes.data,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getFeeReceiptDetails(
  receiptNo: string,
): Promise<{ success: boolean; data?: FeeReceiptData; error?: string }> {
  const user = await getFinanceSession();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const payment = await prisma.paymentTransaction.findFirst({
      where: { receiptNo, schoolId: user.schoolId },
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

    if (!payment) return { success: false, error: "Receipt not found" };

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

    const dateObj = new Date(payment.createdAt || payment.date);
    const timestamp = dateObj.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

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
          if (it.status === "WAIVED") return;
          const compName = it.component?.name || "Fee";
          const compAmount = Number(it.amount || 0);

          if (isLateFeeComp(it)) {
            totalLateFeeAcrossCharges += compAmount;
            if (singleLateFeeRate === 0 && compAmount > 0) {
              singleLateFeeRate = compAmount;
            }
          } else {
            // Keep the actual 1-month rate (not multiplied across months)
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
          totalLateFeeAcrossCharges += Number(alloc.amount || 0);
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
      paidForMonths = `${monthsList[0]} - ${monthsList[0]}`;
    } else if (monthsList.length > 1) {
      paidForMonths = `${monthsList[0]} - ${monthsList[monthsList.length - 1]} (${monthsList.length} Months)`;
    }

    const methodStr = (payment.method || "CASH").replace(/_/g, " ");
    const paymentType = payment.reference
      ? `${methodStr} (${payment.reference})`
      : methodStr;

    const generatedBy = user.name || "School Administration";

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
          if (it.status !== "WAIVED") {
            const amt = Number(it.amount || 0);
            const pd = Number(it.paidAmount || 0);
            chargeBilled += amt;
            chargePaid += pd;
          }
        });
        monthTotalBilled += chargeBilled;
        monthTotalPaid += chargePaid;
        const due = Math.max(0, chargeBilled - chargePaid);
        monthRemainingDue += due;
        if (due > 0 || charge.status !== "PAID") {
          isPartial = true;
        }
      });
    }

    // Build granular month-by-month allocation breakdown (WHAT WAS DUE -> PREVIOUSLY PAID -> PAID TODAY -> BALANCE)
    const monthAllocations: FeeReceiptMonthAllocation[] = [];
    let outstandingBefore = 0;

    // Sort charges by dueDate ascending
    const sortedCharges = Array.from(chargesMap.values()).sort(
      (a: any, b: any) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    sortedCharges.forEach((charge: any) => {
      let feeDue = 0;
      let totalPaidSoFar = 0;

      charge.items?.forEach((it: any) => {
        if (it.status !== "WAIVED") {
          feeDue += Number(it.amount || 0);
          totalPaidSoFar += Number(it.paidAmount || 0);
        }
      });

      // Sum of allocations specifically from THIS payment for this charge
      const paidNow = payment.allocations
        .filter((a: any) => a.chargeItem?.chargeId === charge.id)
        .reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);

      const previouslyPaid = Math.max(0, totalPaidSoFar - paidNow);
      const balanceDue = Math.max(0, feeDue - totalPaidSoFar);
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

      outstandingBefore += feeDue - previouslyPaid;

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

    // Check for advance / surplus in this payment
    const totalAllocatedToCharges = monthAllocations.reduce(
      (sum, m) => sum + m.paidNow,
      0,
    );
    const advanceSurplus = Math.max(0, txAmount - totalAllocatedToCharges);
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

    const remainingOutstanding = Math.max(0, outstandingBefore - txAmount);
    const paymentStatus: "PAID_IN_FULL" | "PARTIAL_PAYMENT" =
      remainingOutstanding <= 0 ? "PAID_IN_FULL" : "PARTIAL_PAYMENT";
    const paymentStatusText =
      remainingOutstanding <= 0
        ? "PAID IN FULL"
        : `PARTIAL PAYMENT — ₹${remainingOutstanding.toLocaleString("en-IN")} DUE`;

    const documentType = isPartial ? "PARTIAL_INVOICE" : "OFFICIAL_RECEIPT";

    const data: FeeReceiptData = {
      schoolName: school?.name || "Horizon Private School",
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

    return { success: true, data };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || "Failed to load receipt details",
    };
  }
}

export async function waiveFeeChargeItem(itemId: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeChargeItem.update({
      where: { id: itemId },
      data: { status: "WAIVED" },
    });
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    await invalidateFeesCache(user.schoolId);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getStudentFeeDues(studentId: string) {
  const user = await getFinanceSession();
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

    // Check if student has active transport with monthlyFee > 0
    const activeTransport = student.transports?.[0];
    if (activeTransport && Number(activeTransport.monthlyFee) > 0) {
      // Ensure Transport Fee component exists
      let transportComp = await prisma.feeComponent.findFirst({
        where: {
          schoolId: user.schoolId,
          category: "TRANSPORT",
        },
      });

      if (!transportComp) {
        transportComp = await prisma.feeComponent.create({
          data: {
            schoolId: user.schoolId,
            name: "Transport Fee",
            description: "Monthly distance-based transport charge",
            category: "TRANSPORT",
            amount: 0,
            frequency: "MONTHLY",
            isOptional: true,
            isActive: true,
          },
        });
      }

      // If open charges exist for this student, check if the latest pending/overdue charge has a Transport Fee item
      const latestCharge = await prisma.feeCharge.findFirst({
        where: {
          studentId,
          schoolId: user.schoolId,
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
        orderBy: { dueDate: "desc" },
        include: { items: true },
      });

      if (latestCharge) {
        const hasTransportItem = latestCharge.items.some(
          (i) => i.componentId === transportComp!.id,
        );
        if (!hasTransportItem) {
          await prisma.feeChargeItem.create({
            data: {
              chargeId: latestCharge.id,
              componentId: transportComp.id,
              amount: activeTransport.monthlyFee,
              paidAmount: 0,
              status: "PENDING",
            },
          });
        }
      }
    }

    const charges = await prisma.feeCharge.findMany({
      where: {
        studentId,
        schoolId: user.schoolId,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
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
    return { error: e.message || "Failed to fetch student fee dues" };
  }
}
