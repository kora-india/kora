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

export async function generateMonthlyFees(sessionId: string, classId: string, monthTitle: string, dueDateStr: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const dueDate = new Date(dueDateStr);
    
    // Find all students in the class
    const students = await prisma.student.findMany({
      where: { classId, schoolId: user.schoolId, isActive: true },
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

        // Calculate components
        const chargeItemsData: any[] = [];
        
        // Base components
        for (const item of classStructure.structure.items) {
          const override = overrides.find(o => o.componentId === item.componentId);
          if (override?.isExempt) continue;

          let finalAmount = override?.amount !== null && override?.amount !== undefined 
              ? Number(override.amount) 
              : Number(item.component.amount);

          if (override?.discountAmount) {
            finalAmount = Math.max(0, finalAmount - Number(override.discountAmount));
          }

          if (finalAmount > 0) {
            chargeItemsData.push({
              componentId: item.componentId,
              amount: finalAmount
            });
          }
        }

        // Add any optional components that are assigned to the student but not in the class structure
        for (const override of overrides) {
          if (override.amount && override.amount > 0 && !classStructure.structure.items.find(i => i.componentId === override.componentId)) {
             chargeItemsData.push({
               componentId: override.componentId,
               amount: Number(override.amount)
             });
          }
        }

        if (chargeItemsData.length > 0) {
          await tx.feeCharge.create({
            data: {
              schoolId: user.schoolId,
              studentId: student.id,
              sessionId,
              title: monthTitle,
              dueDate,
              status: FeeStatus.PENDING,
              items: {
                create: chargeItemsData
              }
            }
          });
          generatedCount++;
        }
      }
    });

    revalidatePath("/fees");
    return { success: true, generatedCount };
  } catch (e: any) {
    return { error: e.message };
  }
}
