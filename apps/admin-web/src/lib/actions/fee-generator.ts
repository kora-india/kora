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
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function processClassFeeGeneration(
  schoolId: string,
  sessionId: string,
  classId: string,
  monthTitle: string,
  dueDate: Date
) {
  try {
    // Find all students in the class
    const students = await prisma.student.findMany({
      where: { classId, schoolId, isActive: true },
    });

    if (students.length === 0) return { error: "No active students in this class" };

    const classStructure = await prisma.classFeeStructure.findFirst({
      where: { classId },
      include: {
        structure: {
          include: {
            items: {
              include: { component: true }
            }
          }
        }
      }
    });

    if (!classStructure) return { error: "No fee structure assigned to this class" };

    let generatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        // Find existing charge to prevent duplicates
        const existingCharge = await tx.feeCharge.findFirst({
          where: { studentId: student.id, sessionId, title: monthTitle }
        });
        if (existingCharge) continue; // Skip if already generated

        // Get student-level overrides
        const overrides = await tx.studentFeeOverride.findMany({
          where: { studentId: student.id, sessionId }
        });

        // Calculate raw components to charge
        const rawItems: { componentId: string; amount: number }[] = [];
        
        // Base components
        for (const item of classStructure.structure.items) {
          const override = overrides.find(o => o.componentId === item.componentId);
          if (override?.isExempt) continue;

          let finalAmount = override?.amount !== null && override?.amount !== undefined 
              ? Number(override.amount) 
              : Number(item.amount ?? item.component.amount);

          if (override?.discountAmount) {
            finalAmount = Math.max(0, finalAmount - Number(override.discountAmount));
          }

          if (finalAmount > 0) {
            rawItems.push({ componentId: item.componentId, amount: finalAmount });
          }
        }

        // Add any optional components that are assigned to the student but not in the class structure
        for (const override of overrides) {
          if (override.amount && Number(override.amount) > 0 && !classStructure.structure.items.find(i => i.componentId === override.componentId)) {
             rawItems.push({ componentId: override.componentId, amount: Number(override.amount) });
          }
        }

        if (rawItems.length === 0) continue;

        // Fetch student's current advance ledger balances
        const ledgers = await tx.advanceLedger.findMany({
          where: { studentId: student.id }
        });
        
        let totalGeneralAdvance = 0;
        const componentAdvances: Record<string, number> = {};
        
        for (const l of ledgers) {
          const amt = Number(l.amount);
          if (l.componentId) {
            componentAdvances[l.componentId] = (componentAdvances[l.componentId] || 0) + amt;
          } else {
            totalGeneralAdvance += amt;
          }
        }

        const chargeItemsData: any[] = [];
        const advancesToDeduct: { componentId?: string, amount: number }[] = [];

        // Try to pay off components using advance balances
        for (const c of rawItems) {
          let remainingDue = c.amount;
          let paidAmount = 0;

          // 1. Try component specific advance
          if (componentAdvances[c.componentId] && componentAdvances[c.componentId] > 0) {
             const use = Math.min(remainingDue, componentAdvances[c.componentId]);
             componentAdvances[c.componentId] -= use;
             remainingDue -= use;
             paidAmount += use;
             advancesToDeduct.push({ componentId: c.componentId, amount: use });
          }

          // 2. Try general advance
          if (remainingDue > 0 && totalGeneralAdvance > 0) {
             const use = Math.min(remainingDue, totalGeneralAdvance);
             totalGeneralAdvance -= use;
             remainingDue -= use;
             paidAmount += use;
             advancesToDeduct.push({ amount: use });
          }

          let itemStatus: FeeStatus = FeeStatus.PENDING;
          if (paidAmount >= c.amount) itemStatus = FeeStatus.PAID;
          else if (paidAmount > 0) itemStatus = FeeStatus.PARTIAL;

          chargeItemsData.push({
            componentId: c.componentId,
            amount: c.amount,
            paidAmount: paidAmount,
            status: itemStatus
          });
        }

        if (chargeItemsData.length > 0) {
          let chargeStatus: FeeStatus = FeeStatus.PENDING;
          if (chargeItemsData.every(i => i.status === FeeStatus.PAID)) chargeStatus = FeeStatus.PAID;
          else if (chargeItemsData.some(i => i.status === FeeStatus.PAID || i.status === FeeStatus.PARTIAL)) chargeStatus = FeeStatus.PARTIAL;

          await tx.feeCharge.create({
            data: {
              schoolId,
              studentId: student.id,
              sessionId,
              title: monthTitle,
              dueDate,
              status: chargeStatus,
              items: {
                create: chargeItemsData
              }
            }
          });

          // Insert negative advance ledger entries to reflect usage
          for (const deduction of advancesToDeduct) {
             await tx.advanceLedger.create({
               data: {
                 studentId: student.id,
                 componentId: deduction.componentId || null,
                 amount: -deduction.amount,
                 description: `Auto-adjusted against generated fee: ${monthTitle}`
               }
             });
          }

          generatedCount++;
        }
      }
    }, { maxWait: 10000, timeout: 30000 });

    return { success: true, generatedCount };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateMonthlyFees(sessionId: string, classId: string, monthTitle: string, dueDateStr: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const res = await processClassFeeGeneration(user.schoolId, sessionId, classId, monthTitle, new Date(dueDateStr));
  if (res.success) {
    await invalidateFeesCache(user.schoolId);
    revalidatePath("/fees");
    revalidatePath("/dashboard");
  }
  return res;
}
