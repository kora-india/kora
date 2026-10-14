import "server-only";

import { prisma, FeeStatus } from "@schoolos/db";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export async function processClassFeeGeneration(
  schoolId: string,
  sessionId: string,
  classId: string,
  monthTitle: string,
  dueDate: Date,
) {
  try {
    // Find all active students in the class
    const students = await prisma.student.findMany({
      where: { classId, schoolId, isActive: true },
    });

    if (students.length === 0)
      return { error: "No active students in this class" };

    // B3: Select fee structure scoped to the academic session and active status
    const classStructure = await prisma.classFeeStructure.findFirst({
      where: {
        classId,
        structure: {
          sessionId,
          status: "ACTIVE",
        },
      },
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
      return {
        error:
          "No active fee structure assigned to this class for the current session",
      };

    // Fetch session for quarterly calculations
    const session = await prisma.academicSession.findUnique({
      where: { id: sessionId },
      select: { id: true, startDate: true },
    });

    const sessionStart = session?.startDate
      ? new Date(session.startDate)
      : new Date(dueDate.getFullYear(), 0, 1);
    const monthsSinceStart =
      (dueDate.getFullYear() - sessionStart.getFullYear()) * 12 +
      (dueDate.getMonth() - sessionStart.getMonth());
    // B1: Quarterly fees due every 3 months starting from session start
    const isQuarterMonth = monthsSinceStart >= 0 && monthsSinceStart % 3 === 0;

    // B2: Standard periodKey format: YYYY-MM based on dueDate
    const periodKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;

    let generatedCount = 0;

    await prisma.$transaction(
      async (tx) => {
        const studentIds = students.map((s) => s.id);

        // B2: Batch find existing charges by periodKey or title
        const existingCharges = await tx.feeCharge.findMany({
          where: {
            studentId: { in: studentIds },
            sessionId,
            OR: [{ periodKey }, { title: monthTitle }],
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

        // Pre-fetch items billed in current session (for YEARLY frequency check)
        // and lifetime billed items (for ONE_TIME frequency check)
        const [
          allOverrides,
          allTransports,
          allLedgers,
          sessionBilledItems,
          lifetimeBilledItems,
        ] = await Promise.all([
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
          tx.feeChargeItem.findMany({
            where: {
              charge: {
                studentId: { in: eligibleIds },
                sessionId,
              },
            },
            select: {
              componentId: true,
              charge: { select: { studentId: true } },
            },
          }),
          tx.feeChargeItem.findMany({
            where: {
              charge: {
                studentId: { in: eligibleIds },
              },
            },
            select: {
              componentId: true,
              charge: { select: { studentId: true } },
            },
          }),
        ]);

        const studentSessionBilled = new Set<string>();
        for (const item of sessionBilledItems) {
          studentSessionBilled.add(
            `${item.charge.studentId}:${item.componentId}`,
          );
        }

        const studentLifetimeBilled = new Set<string>();
        for (const item of lifetimeBilledItems) {
          studentLifetimeBilled.add(
            `${item.charge.studentId}:${item.componentId}`,
          );
        }

        // Fetch any override components not in the class structure
        const overrideCompIds = [
          ...new Set(allOverrides.map((o) => o.componentId)),
        ];
        const overrideComponents = await tx.feeComponent.findMany({
          where: { id: { in: overrideCompIds }, schoolId },
        });
        const overrideCompMap = new Map(
          overrideComponents.map((c) => [c.id, c]),
        );

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

        // Ensure Transport Fee component exists once (B11: uppercase "TRANSPORT")
        let transportComp: any = null;
        if (allTransports.some((t) => Number(t.monthlyFee) > 0)) {
          transportComp = await tx.feeComponent.findFirst({
            where: {
              schoolId,
              category: "TRANSPORT",
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
        const pendingAdvancePayments: {
          studentId: string;
          totalAdjusted: number;
          advancesToDeduct: {
            componentId?: string;
            amount: number;
            chargeItemId: string;
          }[];
        }[] = [];

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
            const comp = item.component;
            // B1: Skip inactive components
            if (!comp || !comp.isActive) continue;

            // B1: Frequency enforcement
            if (comp.frequency === "QUARTERLY" && !isQuarterMonth) continue;
            if (
              comp.frequency === "YEARLY" &&
              studentSessionBilled.has(`${student.id}:${comp.id}`)
            )
              continue;
            if (
              comp.frequency === "ONE_TIME" &&
              studentLifetimeBilled.has(`${student.id}:${comp.id}`)
            )
              continue;

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

            finalAmount = roundMoney(finalAmount);

            if (finalAmount > 0) {
              rawItems.push({
                componentId: item.componentId,
                amount: finalAmount,
              });
            }
          }

          // Add optional components assigned to student via overrides but not in structure
          for (const override of overrides) {
            if (
              override.amount &&
              Number(override.amount) > 0 &&
              !classStructure.structure.items.find(
                (i) => i.componentId === override.componentId,
              )
            ) {
              const comp = overrideCompMap.get(override.componentId);
              if (!comp || !comp.isActive) continue;
              if (comp.frequency === "QUARTERLY" && !isQuarterMonth) continue;
              if (
                comp.frequency === "YEARLY" &&
                studentSessionBilled.has(`${student.id}:${comp.id}`)
              )
                continue;
              if (
                comp.frequency === "ONE_TIME" &&
                studentLifetimeBilled.has(`${student.id}:${comp.id}`)
              )
                continue;

              let finalAmount = Number(override.amount);
              if (override.discountAmount) {
                finalAmount = Math.max(
                  0,
                  finalAmount - Number(override.discountAmount),
                );
              }
              finalAmount = roundMoney(finalAmount);

              if (finalAmount > 0) {
                rawItems.push({
                  componentId: override.componentId,
                  amount: finalAmount,
                });
              }
            }
          }

          // Check transport (B1: Monthly transport fee)
          const transport = transportByStudent.get(student.id);
          if (transport && Number(transport.monthlyFee) > 0 && transportComp) {
            if (!rawItems.some((i) => i.componentId === transportComp.id)) {
              rawItems.push({
                componentId: transportComp.id,
                amount: roundMoney(Number(transport.monthlyFee)),
              });
            }
          }

          if (rawItems.length === 0) continue;

          // Advance ledger balances
          const ledgers = ledgersByStudent.get(student.id) || [];
          let totalGeneralAdvance = 0;
          const componentAdvances: Record<string, number> = {};

          for (const l of ledgers) {
            const amt = roundMoney(Number(l.amount));
            if (l.componentId) {
              componentAdvances[l.componentId] = roundMoney(
                (componentAdvances[l.componentId] || 0) + amt,
              );
            } else {
              totalGeneralAdvance = roundMoney(totalGeneralAdvance + amt);
            }
          }

          const studentChargeItems: {
            id: string;
            componentId: string;
            amount: number;
            paidAmount: number;
            status: FeeStatus;
          }[] = [];
          const studentDeductions: {
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
              const use = roundMoney(
                Math.min(remainingDue, componentAdvances[c.componentId]),
              );
              componentAdvances[c.componentId] = roundMoney(
                componentAdvances[c.componentId] - use,
              );
              remainingDue = roundMoney(remainingDue - use);
              paidAmount = roundMoney(paidAmount + use);
              studentDeductions.push({
                componentId: c.componentId,
                amount: use,
                chargeItemId,
              });
            }

            // 2. Try general advance
            if (remainingDue > 0 && totalGeneralAdvance > 0) {
              const use = roundMoney(
                Math.min(remainingDue, totalGeneralAdvance),
              );
              totalGeneralAdvance = roundMoney(totalGeneralAdvance - use);
              remainingDue = roundMoney(remainingDue - use);
              paidAmount = roundMoney(paidAmount + use);
              studentDeductions.push({ amount: use, chargeItemId });
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
              periodKey,
              dueDate,
              status: chargeStatus,
            });

            if (studentDeductions.length > 0) {
              const totalAdjusted = roundMoney(
                studentDeductions.reduce((sum, d) => sum + d.amount, 0),
              );
              pendingAdvancePayments.push({
                studentId: student.id,
                totalAdjusted,
                advancesToDeduct: studentDeductions,
              });
            }

            generatedCount++;
          }
        }

        // B4: Generate atomic, sequential receipt numbers for advance settlements
        const paymentsToCreate: any[] = [];
        const allocationsToCreate: any[] = [];
        const advancesToCreate: any[] = [];

        if (pendingAdvancePayments.length > 0) {
          const updatedSchool = await tx.school.update({
            where: { id: schoolId },
            data: {
              nextReceiptNumber: { increment: pendingAdvancePayments.length },
            },
            select: { nextReceiptNumber: true, receiptPrefix: true },
          });

          const prefix = updatedSchool.receiptPrefix || "RCP";
          const startSeq =
            updatedSchool.nextReceiptNumber - pendingAdvancePayments.length;
          const currentYear = new Date().getFullYear();

          for (let i = 0; i < pendingAdvancePayments.length; i++) {
            const item = pendingAdvancePayments[i];
            const seq = startSeq + i;
            const receiptNo = `${prefix}-${currentYear}-${String(seq).padStart(5, "0")}`;
            const paymentId = createCuid();

            paymentsToCreate.push({
              id: paymentId,
              schoolId,
              studentId: item.studentId,
              amount: item.totalAdjusted,
              method: "OTHER",
              reference: `Advance settlement for ${monthTitle}`,
              receiptNo,
              remarks: `Auto-settled from student advance balance for ${monthTitle}`,
              status: "SUCCESS",
            });

            for (const deduction of item.advancesToDeduct) {
              allocationsToCreate.push({
                id: createCuid(),
                paymentId: paymentId,
                chargeItemId: deduction.chargeItemId,
                amount: deduction.amount,
              });

              advancesToCreate.push({
                id: createCuid(),
                studentId: item.studentId,
                componentId: deduction.componentId || null,
                amount: -deduction.amount,
                description: `Auto-adjusted against generated fee: ${monthTitle}`,
              });
            }
          }
        }

        // Execute bulk writes
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
