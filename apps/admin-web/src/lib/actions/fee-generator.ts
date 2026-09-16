"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeStatus } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { invalidateFeesCache } from "@/lib/redis";

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role))
    return null;
  return { ...user, schoolId: user.schoolId };
}

export async function processClassFeeGeneration(
  schoolId: string,
  sessionId: string,
  classId: string,
  monthTitle: string,
  dueDate: Date,
) {
  try {
    // Find all students in the class
    const students = await prisma.student.findMany({
      where: { classId, schoolId, isActive: true },
    });

    if (students.length === 0)
      return { error: "No active students in this class" };

    const classStructure = await prisma.classFeeStructure.findFirst({
      where: { classId },
      include: {
        structure: {
          include: {
            items: {
              include: { component: true },
            },
          },
        },
      },
    });

    if (!classStructure)
      return { error: "No fee structure assigned to this class" };

    let generatedCount = 0;

    await prisma.$transaction(
      async (tx) => {
        const studentIds = students.map((s) => s.id);

        // 1. Batch find existing charges
        const existingCharges = await tx.feeCharge.findMany({
          where: {
            studentId: { in: studentIds },
            sessionId,
            title: monthTitle,
          },
          select: { studentId: true },
        });
        const existingStudentIds = new Set(
          existingCharges.map((c) => c.studentId),
        );
        const eligibleStudents = students.filter(
          (s) => !existingStudentIds.has(s.id),
        );

        if (eligibleStudents.length === 0) return;

        const eligibleIds = eligibleStudents.map((s) => s.id);

        // 2. Batch fetch all overrides, active transports, and ledgers in parallel
        const [allOverrides, allTransports, allLedgers] = await Promise.all([
          tx.studentFeeOverride.findMany({
            where: { studentId: { in: eligibleIds }, sessionId },
          }),
          tx.studentTransport.findMany({
            where: {
              studentId: { in: eligibleIds },
              sessionId,
              status: "ACTIVE",
            },
          }),
          tx.advanceLedger.findMany({
            where: { studentId: { in: eligibleIds } },
          }),
        ]);

        // Index pre-fetched data by studentId
        const overridesByStudent = new Map<string, typeof allOverrides>();
        for (const o of allOverrides) {
          if (!overridesByStudent.has(o.studentId))
            overridesByStudent.set(o.studentId, []);
          overridesByStudent.get(o.studentId)!.push(o);
        }

        const transportByStudent = new Map<string, (typeof allTransports)[0]>();
        for (const t of allTransports) {
          transportByStudent.set(t.studentId, t);
        }

        const ledgersByStudent = new Map<string, typeof allLedgers>();
        for (const l of allLedgers) {
          if (!ledgersByStudent.has(l.studentId))
            ledgersByStudent.set(l.studentId, []);
          ledgersByStudent.get(l.studentId)!.push(l);
        }

        // Ensure Transport Fee component exists once
        let transportComp: any = null;
        if (allTransports.some((t) => Number(t.monthlyFee) > 0)) {
          transportComp = await tx.feeComponent.findFirst({
            where: {
              schoolId,
              name: { equals: "Transport Fee", mode: "insensitive" },
            },
          });
          if (!transportComp) {
            transportComp = await tx.feeComponent.create({
              data: {
                schoolId,
                name: "Transport Fee",
                description: "Distance-based monthly transport charge",
                category: "TRANSPORT",
                amount: 0,
                frequency: "MONTHLY",
                isOptional: true,
                isActive: true,
              },
            });
          }
        }

        const chargesToCreate: any[] = [];
        const chargeItemsToCreate: any[] = [];
        const paymentsToCreate: any[] = [];
        const allocationsToCreate: any[] = [];
        const advancesToCreate: any[] = [];

        function createCuid(): string {
          return (
            "c" +
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 10) +
            Math.random().toString(36).substring(2, 6)
          );
        }

        for (const student of eligibleStudents) {
          const overrides = overridesByStudent.get(student.id) || [];
          const rawItems: { componentId: string; amount: number }[] = [];

          // Base components from structure
          for (const item of classStructure.structure.items) {
            const override = overrides.find(
              (o) => o.componentId === item.componentId,
            );
            if (override?.isExempt) continue;

            let finalAmount =
              override?.amount !== null && override?.amount !== undefined
                ? Number(override.amount)
                : Number(item.amount ?? item.component.amount);

            if (override?.discountAmount) {
              finalAmount = Math.max(
                0,
                finalAmount - Number(override.discountAmount),
              );
            }

            if (finalAmount > 0) {
              rawItems.push({
                componentId: item.componentId,
                amount: finalAmount,
              });
            }
          }

          // Add optional components assigned to student but not in structure
          for (const override of overrides) {
            if (
              override.amount &&
              Number(override.amount) > 0 &&
              !classStructure.structure.items.find(
                (i) => i.componentId === override.componentId,
              )
            ) {
              rawItems.push({
                componentId: override.componentId,
                amount: Number(override.amount),
              });
            }
          }

          // Check transport
          const transport = transportByStudent.get(student.id);
          if (transport && Number(transport.monthlyFee) > 0 && transportComp) {
            if (!rawItems.some((i) => i.componentId === transportComp.id)) {
              rawItems.push({
                componentId: transportComp.id,
                amount: Number(transport.monthlyFee),
              });
            }
          }

          if (rawItems.length === 0) continue;

          // Advance ledger balances
          const ledgers = ledgersByStudent.get(student.id) || [];
          let totalGeneralAdvance = 0;
          const componentAdvances: Record<string, number> = {};

          for (const l of ledgers) {
            const amt = Number(l.amount);
            if (l.componentId) {
              componentAdvances[l.componentId] =
                (componentAdvances[l.componentId] || 0) + amt;
            } else {
              totalGeneralAdvance += amt;
            }
          }

          const studentChargeItems: {
            id: string;
            componentId: string;
            amount: number;
            paidAmount: number;
            status: FeeStatus;
          }[] = [];
          const advancesToDeduct: {
            componentId?: string;
            amount: number;
            chargeItemId: string;
          }[] = [];
          const chargeId = createCuid();

          // Try to pay off components using advance balances
          for (const c of rawItems) {
            let remainingDue = c.amount;
            let paidAmount = 0;
            const chargeItemId = createCuid();

            // 1. Try component specific advance
            if (
              componentAdvances[c.componentId] &&
              componentAdvances[c.componentId] > 0
            ) {
              const use = Math.min(
                remainingDue,
                componentAdvances[c.componentId],
              );
              componentAdvances[c.componentId] -= use;
              remainingDue -= use;
              paidAmount += use;
              advancesToDeduct.push({
                componentId: c.componentId,
                amount: use,
                chargeItemId,
              });
            }

            // 2. Try general advance
            if (remainingDue > 0 && totalGeneralAdvance > 0) {
              const use = Math.min(remainingDue, totalGeneralAdvance);
              totalGeneralAdvance -= use;
              remainingDue -= use;
              paidAmount += use;
              advancesToDeduct.push({ amount: use, chargeItemId });
            }

            let itemStatus: FeeStatus = FeeStatus.PENDING;
            if (paidAmount >= c.amount) itemStatus = FeeStatus.PAID;
            else if (paidAmount > 0) itemStatus = FeeStatus.PARTIAL;

            studentChargeItems.push({
              id: chargeItemId,
              componentId: c.componentId,
              amount: c.amount,
              paidAmount: paidAmount,
              status: itemStatus,
            });

            chargeItemsToCreate.push({
              id: chargeItemId,
              chargeId: chargeId,
              componentId: c.componentId,
              amount: c.amount,
              paidAmount: paidAmount,
              status: itemStatus,
            });
          }

          if (studentChargeItems.length > 0) {
            let chargeStatus: FeeStatus = FeeStatus.PENDING;
            if (studentChargeItems.every((i) => i.status === FeeStatus.PAID))
              chargeStatus = FeeStatus.PAID;
            else if (
              studentChargeItems.some(
                (i) =>
                  i.status === FeeStatus.PAID || i.status === FeeStatus.PARTIAL,
              )
            )
              chargeStatus = FeeStatus.PARTIAL;

            chargesToCreate.push({
              id: chargeId,
              schoolId,
              studentId: student.id,
              sessionId,
              title: monthTitle,
              dueDate,
              status: chargeStatus,
            });

            // Insert negative advance ledger entries and create PaymentTransaction record
            if (advancesToDeduct.length > 0) {
              const totalAdjusted = advancesToDeduct.reduce(
                (sum, d) => sum + d.amount,
                0,
              );
              const receiptNo = `ADV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(100 + Math.random() * 900)}`;
              const paymentId = createCuid();

              paymentsToCreate.push({
                id: paymentId,
                schoolId,
                studentId: student.id,
                amount: totalAdjusted,
                method: "OTHER",
                reference: `Advance settlement for ${monthTitle}`,
                receiptNo,
                remarks: `Auto-settled from student advance balance for ${monthTitle}`,
                status: "SUCCESS",
              });

              for (const deduction of advancesToDeduct) {
                allocationsToCreate.push({
                  id: createCuid(),
                  paymentId: paymentId,
                  chargeItemId: deduction.chargeItemId,
                  amount: deduction.amount,
                });

                advancesToCreate.push({
                  id: createCuid(),
                  studentId: student.id,
                  componentId: deduction.componentId || null,
                  amount: -deduction.amount,
                  description: `Auto-adjusted against generated fee: ${monthTitle}`,
                });
              }
            }

            generatedCount++;
          }
        }

        // Execute all bulk writes in 4 parallel/sequential single operations
        if (chargesToCreate.length > 0) {
          await tx.feeCharge.createMany({ data: chargesToCreate });
          await tx.feeChargeItem.createMany({ data: chargeItemsToCreate });
        }

        if (paymentsToCreate.length > 0) {
          await tx.paymentTransaction.createMany({ data: paymentsToCreate });
        }

        if (allocationsToCreate.length > 0) {
          await tx.paymentAllocation.createMany({ data: allocationsToCreate });
        }

        if (advancesToCreate.length > 0) {
          await tx.advanceLedger.createMany({ data: advancesToCreate });
        }
      },
      { maxWait: 10000, timeout: 60000 },
    );

    return { success: true, generatedCount };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateMonthlyFees(
  sessionId: string,
  classIds: string[] | string,
  monthTitle: string,
  dueDateStr: string,
) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const ids = Array.isArray(classIds) ? classIds : [classIds];
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return { error: "Please select at least one target class" };
  }

  let totalGenerated = 0;
  const errors: { classId: string; error: string }[] = [];
  const dueDate = new Date(dueDateStr);

  for (const cId of uniqueIds) {
    const res = await processClassFeeGeneration(
      user.schoolId,
      sessionId,
      cId,
      monthTitle,
      dueDate,
    );

    if (res.error) {
      errors.push({ classId: cId, error: res.error });
    } else if (res.generatedCount) {
      totalGenerated += res.generatedCount;
    }
  }

  if (totalGenerated > 0 || errors.length === 0) {
    await invalidateFeesCache(user.schoolId);
    revalidatePath("/fees");
    revalidatePath("/dashboard");
  }

  if (errors.length > 0 && totalGenerated === 0) {
    return { error: errors.map((e) => e.error).join(", ") };
  }

  return {
    success: true,
    generatedCount: totalGenerated,
    skippedOrErrors: errors.length > 0 ? errors : undefined,
  };
}
