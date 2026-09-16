"use server";

import { auth } from "@schoolos/auth";
import { prisma, FeeFrequency } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { invalidateCache, invalidateFeesCache } from "@/lib/redis";

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role))
    return null;
  return { ...user, schoolId: user.schoolId };
}

// -- Academic Sessions
export async function createAcademicSession(data: {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    if (data.isCurrent) {
      // Unset current session if this one is true
      await prisma.academicSession.updateMany({
        where: { schoolId: user.schoolId },
        data: { isCurrent: false },
      });
    }

    await prisma.academicSession.create({
      data: {
        schoolId: user.schoolId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:academicSessions:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Fee Components
export async function createFeeComponent(data: {
  name: string;
  amount: number;
  frequency: FeeFrequency;
  isOptional: boolean;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeComponent.create({
      data: {
        schoolId: user.schoolId,
        name: data.name,
        amount: data.amount,
        frequency: data.frequency,
        isOptional: data.isOptional,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:feeComponents:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Fee Structures
export async function createFeeStructure(data: {
  name: string;
  sessionId: string;
  components: { componentId: string; amount?: number }[];
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeStructure.create({
      data: {
        schoolId: user.schoolId,
        sessionId: data.sessionId,
        name: data.name,
        items: {
          create: data.components.map((c) => ({
            componentId: c.componentId,
            amount: c.amount,
          })),
        },
      },
    });

    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Class Assignments
export async function assignFeeStructureToClass(
  classId: string,
  structureId: string,
) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    // Upsert assignment for class
    const existing = await prisma.classFeeStructure.findFirst({
      where: { classId },
    });

    if (existing) {
      await prisma.classFeeStructure.update({
        where: { id: existing.id },
        data: { structureId },
      });
    } else {
      await prisma.classFeeStructure.create({
        data: { classId, structureId },
      });
    }

    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    revalidatePath("/classes");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Student Overrides
export async function setStudentFeeOverride(
  studentId: string,
  sessionId: string,
  componentId: string,
  data: { isExempt: boolean; discountAmount: number; amount?: number },
) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.studentFeeOverride.findUnique({
      where: {
        studentId_sessionId_componentId: {
          studentId,
          sessionId,
          componentId,
        },
      },
    });

    if (existing) {
      await prisma.studentFeeOverride.update({
        where: { id: existing.id },
        data: {
          isExempt: data.isExempt,
          discountAmount: data.discountAmount,
          amount: data.amount,
        },
      });
    } else {
      await prisma.studentFeeOverride.create({
        data: {
          studentId,
          sessionId,
          componentId,
          isExempt: data.isExempt,
          discountAmount: data.discountAmount,
          amount: data.amount,
        },
      });
    }

    await invalidateCache(`cache:${user.schoolId}:students:*`);
    revalidatePath("/fees");
    revalidatePath(`/students/${studentId}`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Update Academic Session
export async function updateAcademicSession(
  id: string,
  data: {
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  },
) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    if (data.isCurrent) {
      await prisma.academicSession.updateMany({
        where: { schoolId: user.schoolId },
        data: { isCurrent: false },
      });
    }

    await prisma.academicSession.update({
      where: { id, schoolId: user.schoolId },
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:academicSessions:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Update Fee Component
export async function updateFeeComponent(
  id: string,
  data: {
    name: string;
    amount: number;
    frequency: FeeFrequency;
    isOptional: boolean;
  },
) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeComponent.update({
      where: { id, schoolId: user.schoolId },
      data: {
        name: data.name,
        amount: data.amount,
        frequency: data.frequency,
        isOptional: data.isOptional,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:feeComponents:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Update Fee Structure
export async function updateFeeStructure(
  id: string,
  data: {
    name: string;
    sessionId: string;
    components: { componentId: string; amount?: number }[];
  },
) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    // We need to recreate the items relation
    await prisma.feeStructure.update({
      where: { id, schoolId: user.schoolId },
      data: {
        sessionId: data.sessionId,
        name: data.name,
        items: {
          deleteMany: {},
          create: data.components.map((c) => ({
            componentId: c.componentId,
            amount: c.amount,
          })),
        },
      },
    });

    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Late Fee Settings
export async function saveLateFeeSettings(data: {
  lateFeeEnabled: boolean;
  lateFeeAmount?: number;
  lateFeeFrequency?: string;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.school.update({
      where: { id: user.schoolId },
      data: {
        lateFeeEnabled: data.lateFeeEnabled,
        lateFeeAmount:
          data.lateFeeAmount !== undefined ? data.lateFeeAmount : null,
        lateFeeFrequency: data.lateFeeFrequency || "MONTHLY",
      },
    });

    // If enabled, ensure the "Late Fee" FeeComponent exists
    if (data.lateFeeEnabled) {
      const existing = await prisma.feeComponent.findFirst({
        where: { schoolId: user.schoolId, category: "LATE_FEE" },
      });
      if (!existing) {
        await prisma.feeComponent.create({
          data: {
            schoolId: user.schoolId,
            name: "Late Fee",
            category: "LATE_FEE",
            amount: data.lateFeeAmount || 0,
            frequency: "MONTHLY",
            isOptional: false,
          },
        });
      } else if (
        existing.amount &&
        Number(existing.amount) !== data.lateFeeAmount
      ) {
        await prisma.feeComponent.update({
          where: { id: existing.id },
          data: { amount: data.lateFeeAmount || 0 },
        });
      }
    }

    await invalidateCache(`cache:${user.schoolId}:school:*`);
    await invalidateCache(`cache:${user.schoolId}:feeComponents:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// -- Fee Collection Policy Settings
export async function saveFeeCollectionPolicy(data: {
  feePaymentMode: "FULL_ONLY" | "ALLOW_PARTIAL";
  minPartialPaymentPercentage?: number;
  minPartialPaymentAmount?: number;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const minPercent =
      data.feePaymentMode === "ALLOW_PARTIAL"
        ? data.minPartialPaymentPercentage !== undefined &&
          !isNaN(Number(data.minPartialPaymentPercentage))
          ? Math.max(0, Math.min(100, Number(data.minPartialPaymentPercentage)))
          : 0
        : 0;

    await prisma.school.update({
      where: { id: user.schoolId },
      data: {
        feePaymentMode: data.feePaymentMode,
        minPartialPaymentPercentage: minPercent,
        minPartialPaymentAmount:
          data.minPartialPaymentAmount !== undefined &&
          !isNaN(Number(data.minPartialPaymentAmount))
            ? Number(data.minPartialPaymentAmount)
            : 0,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:school:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
