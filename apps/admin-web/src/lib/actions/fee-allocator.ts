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

export interface FeeReceiptData {
  schoolName: string;
  schoolAddress: string;
  schoolContact: string;
  timestamp: string;
  receiptNo: string;
  regNo: string;
  studentName: string;
  className: string;
  items: FeeReceiptItem[];
  total: number;
  amountPaid: number;
  paidForMonths: string;
  paymentType: string;
  generatedBy: string;
}

export async function allocatePayment(data: {
  studentId: string;
  itemPayments?: { chargeItemId: string; amount: number }[];
  componentPayments?: { componentId: string; amount: number }[];
  generalAdvanceAmount?: number;
  method: PaymentMethod;
  reference?: string;
  remarks?: string;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const itemTotal = (data.itemPayments || []).reduce(
    (sum, ip) => sum + ip.amount,
    0,
  );
  const componentTotal = (data.componentPayments || []).reduce(
    (sum, cp) => sum + cp.amount,
    0,
  );
  const totalPayment =
    itemTotal + componentTotal + (data.generalAdvanceAmount || 0);
  if (totalPayment <= 0)
    return { error: "Payment amount must be greater than zero." };

  try {
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

        // 2. Allocate item-wise payments if provided
        if (data.itemPayments && data.itemPayments.length > 0) {
          for (const ip of data.itemPayments) {
            if (ip.amount <= 0) continue;

            const item = await tx.feeChargeItem.findUnique({
              where: { id: ip.chargeItemId },
              include: { charge: true },
            });

            if (!item || item.charge.studentId !== data.studentId) continue;

            const due = Number(item.amount) - Number(item.paidAmount);
            const allocAmount = Math.min(due, ip.amount);
            const surplus = Math.max(0, ip.amount - due);

            if (allocAmount > 0) {
              allocationsCreated.push({
                paymentId: payment.id,
                chargeItemId: item.id,
                amount: allocAmount,
              });

              const newPaidAmount = Number(item.paidAmount) + allocAmount;
              let newItemStatus = item.status;
              if (newPaidAmount >= Number(item.amount)) {
                newItemStatus = FeeStatus.PAID;
              } else if (newPaidAmount > 0) {
                newItemStatus = FeeStatus.PARTIAL;
              }

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

        // 3. Allocate component-wise payments if provided
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
                let newItemStatus = item.status;
                if (newPaidAmount >= Number(item.amount)) {
                  newItemStatus = FeeStatus.PAID;
                } else if (newPaidAmount > 0) {
                  newItemStatus = FeeStatus.PARTIAL;
                }

                await tx.feeChargeItem.update({
                  where: { id: item.id },
                  data: { paidAmount: newPaidAmount, status: newItemStatus },
                });

                affectedChargeIds.add(item.chargeId);
              }
            }

            // Create component-specific advance if there's remaining amount
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

        // 4. Create General Advance if explicitly provided
        if (data.generalAdvanceAmount && data.generalAdvanceAmount > 0) {
          await tx.advanceLedger.create({
            data: {
              studentId: data.studentId,
              amount: data.generalAdvanceAmount,
              description: `General Advance from payment ${receiptNo}`,
            },
          });
        }

        // 5. Create Allocations
        if (allocationsCreated.length > 0) {
          await tx.paymentAllocation.createMany({
            data: allocationsCreated,
          });
        }

        // 6. Update Parent Charge Statuses
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
              include: { component: true, charge: true },
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

    const headMap: Record<string, number> = {};
    const monthsSet = new Set<string>();

    for (const alloc of payment.allocations) {
      const compName = alloc.chargeItem?.component?.name || "Fee";
      const amt = Number(alloc.amount || 0);
      headMap[compName] = (headMap[compName] || 0) + amt;

      const chargeTitle = alloc.chargeItem?.charge?.title;
      if (chargeTitle) {
        monthsSet.add(chargeTitle);
      }
    }

    const items: FeeReceiptItem[] = Object.entries(headMap).map(
      ([head, amount]) => ({
        head,
        amount,
      }),
    );

    const totalAllocated = items.reduce((sum, item) => sum + item.amount, 0);
    const txAmount = Number(payment.amount || 0);

    if (txAmount > totalAllocated) {
      items.push({
        head: "General Advance Credit",
        amount: txAmount - totalAllocated,
      });
    } else if (items.length === 0 && txAmount > 0) {
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
      paidForMonths = `${monthsList[0]} - ${monthsList[monthsList.length - 1]}`;
    }

    const methodStr = (payment.method || "CASH").replace(/_/g, " ");
    const paymentType = payment.reference
      ? `${methodStr} (${payment.reference})`
      : methodStr;

    const generatedBy = user.name || "School Administration";

    const data: FeeReceiptData = {
      schoolName: school?.name || "Horizon Private School",
      schoolAddress,
      schoolContact,
      timestamp,
      receiptNo: payment.receiptNo,
      regNo,
      studentName: student.name,
      className,
      items,
      total: txAmount,
      amountPaid: txAmount,
      paidForMonths,
      paymentType,
      generatedBy,
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
