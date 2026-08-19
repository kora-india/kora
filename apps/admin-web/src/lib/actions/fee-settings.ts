"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeFrequency } from "@schoolos/db";
import { revalidatePath } from "next/cache";

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

// -- Academic Sessions
export async function createAcademicSession(data: { name: string; startDate: string; endDate: string; isCurrent: boolean }) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    if (data.isCurrent) {
      // Unset current session if this one is true
      await prisma.academicSession.updateMany({
        where: { schoolId: user.schoolId },
        data: { isCurrent: false }
      });
    }

    await prisma.academicSession.create({
      data: {
        schoolId: user.schoolId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent
      }
    });

    revalidatePath("/fees/settings");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Fee Components
export async function createFeeComponent(data: { name: string; amount: number; frequency: FeeFrequency; isOptional: boolean }) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeComponent.create({
      data: {
        schoolId: user.schoolId,
        name: data.name,
        amount: data.amount,
        frequency: data.frequency,
        isOptional: data.isOptional
      }
    });

    revalidatePath("/fees/settings");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Fee Structures
export async function createFeeStructure(data: { name: string; sessionId: string; componentIds: string[] }) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeStructure.create({
      data: {
        schoolId: user.schoolId,
        sessionId: data.sessionId,
        name: data.name,
        items: {
          create: data.componentIds.map(id => ({ componentId: id }))
        }
      }
    });

    revalidatePath("/fees/settings");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Class Assignments
export async function assignFeeStructureToClass(classId: string, structureId: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    // Upsert assignment for class
    const existing = await prisma.classFeeStructure.findFirst({
      where: { classId }
    });

    if (existing) {
      await prisma.classFeeStructure.update({
        where: { id: existing.id },
        data: { structureId }
      });
    } else {
      await prisma.classFeeStructure.create({
        data: { classId, structureId }
      });
    }

    revalidatePath("/fees/assignments");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Student Overrides
export async function setStudentFeeOverride(studentId: string, sessionId: string, componentId: string, data: { isExempt: boolean; discountAmount: number; amount?: number }) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.studentFeeOverride.findUnique({
      where: {
        studentId_sessionId_componentId: {
          studentId,
          sessionId,
          componentId
        }
      }
    });

    if (existing) {
      await prisma.studentFeeOverride.update({
        where: { id: existing.id },
        data: {
          isExempt: data.isExempt,
          discountAmount: data.discountAmount,
          amount: data.amount
        }
      });
    } else {
      await prisma.studentFeeOverride.create({
        data: {
          studentId,
          sessionId,
          componentId,
          isExempt: data.isExempt,
          discountAmount: data.discountAmount,
          amount: data.amount
        }
      });
    }

    revalidatePath("/fees/assignments");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
