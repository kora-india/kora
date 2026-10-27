"use server";

import { z } from "zod";
import { isError, requirePermission } from "@/lib/auth-guard";
import { prisma, FeeFrequency } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { invalidateCache, invalidateFeesCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";

async function getFinanceSession() {
  const access = await requirePermission("fees", "manage");
  return isError(access) ? null : access;
}

const academicSessionSchema = z
  .object({
    name: z.string().trim().min(1, "Session name is required"),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Valid start date required"),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Valid end date required"),
    isCurrent: z.boolean(),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: "Start date must be before end date",
    path: ["endDate"],
  });

const feeComponentSchema = z.object({
  name: z.string().trim().min(1, "Component name is required").max(100),
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a number" })
    .min(0, "Amount can't be negative")
    .max(10_000_000, "Amount is too large"),
  frequency: z.nativeEnum(FeeFrequency),
  isOptional: z.boolean(),
});

// -- Academic Sessions
export async function createAcademicSession(data: {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = academicSessionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid session data" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isCurrent) {
        // Unset current session if this one is true
        await tx.academicSession.updateMany({
          where: { schoolId: user.schoolId },
          data: { isCurrent: false },
        });
      }

      await tx.academicSession.create({
        data: {
          schoolId: user.schoolId,
          name: parsed.data.name,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          isCurrent: parsed.data.isCurrent,
        },
      });
    });

    await invalidateCache(`cache:${user.schoolId}:academicSessions:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
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

  const parsed = feeComponentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Invalid fee component",
    };
  }

  try {
    await prisma.feeComponent.create({
      data: {
        schoolId: user.schoolId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        frequency: parsed.data.frequency,
        isOptional: parsed.data.isOptional,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:feeComponents:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
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
    const session = await prisma.academicSession.findFirst({
      where: { id: data.sessionId, schoolId: user.schoolId },
    });
    if (!session) return { error: "Academic session not found in your school" };

    const compIds = [...new Set(data.components.map((c) => c.componentId))];
    const validComps = await prisma.feeComponent.findMany({
      where: { id: { in: compIds }, schoolId: user.schoolId },
      select: { id: true },
    });
    if (validComps.length !== compIds.length) {
      return { error: "One or more fee components not found in your school" };
    }

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
    return { error: actionErrorMessage(e) };
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
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: user.schoolId },
    });
    if (!cls) return { error: "Class not found in your school" };

    const structure = await prisma.feeStructure.findFirst({
      where: { id: structureId, schoolId: user.schoolId },
    });
    if (!structure) return { error: "Fee structure not found in your school" };

    // B3: Upsert assignment for class scoped to the same academic session
    const existing = await prisma.classFeeStructure.findFirst({
      where: {
        classId,
        structure: { sessionId: structure.sessionId },
      },
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
    return { error: actionErrorMessage(e) };
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
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
    });
    if (!student) return { error: "Student not found in your school" };

    const session = await prisma.academicSession.findFirst({
      where: { id: sessionId, schoolId: user.schoolId },
    });
    if (!session) return { error: "Academic session not found in your school" };

    const component = await prisma.feeComponent.findFirst({
      where: { id: componentId, schoolId: user.schoolId },
    });
    if (!component) return { error: "Fee component not found in your school" };

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
    return { error: actionErrorMessage(e) };
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

  const parsed = academicSessionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid session data" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.academicSession.findFirst({
        where: { id, schoolId: user.schoolId },
      });
      if (!existing) {
        throw new Error("Academic session not found in your school");
      }

      if (parsed.data.isCurrent) {
        await tx.academicSession.updateMany({
          where: { schoolId: user.schoolId, id: { not: id } },
          data: { isCurrent: false },
        });
      } else if (existing.isCurrent) {
        // B15: Preserving a current session: if unsetting current session, make another session current if one exists
        const fallback = await tx.academicSession.findFirst({
          where: { schoolId: user.schoolId, id: { not: id } },
          orderBy: { startDate: "desc" },
        });
        if (fallback) {
          await tx.academicSession.update({
            where: { id: fallback.id },
            data: { isCurrent: true },
          });
        }
      }

      await tx.academicSession.update({
        where: { id, schoolId: user.schoolId },
        data: {
          name: parsed.data.name,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          isCurrent: parsed.data.isCurrent,
        },
      });
    });

    await invalidateCache(`cache:${user.schoolId}:academicSessions:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
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

  const parsed = feeComponentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Invalid fee component",
    };
  }

  try {
    await prisma.feeComponent.update({
      where: { id, schoolId: user.schoolId },
      data: {
        name: parsed.data.name,
        amount: parsed.data.amount,
        frequency: parsed.data.frequency,
        isOptional: parsed.data.isOptional,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:feeComponents:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
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
    const existing = await prisma.feeStructure.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) return { error: "Fee structure not found in your school" };

    const session = await prisma.academicSession.findFirst({
      where: { id: data.sessionId, schoolId: user.schoolId },
    });
    if (!session) return { error: "Academic session not found in your school" };

    const compIds = [...new Set(data.components.map((c) => c.componentId))];
    const validComps = await prisma.feeComponent.findMany({
      where: { id: { in: compIds }, schoolId: user.schoolId },
      select: { id: true },
    });
    if (validComps.length !== compIds.length) {
      return { error: "One or more fee components not found in your school" };
    }

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
    return { error: actionErrorMessage(e) };
  }
}

// -- Late Fee Settings
const lateFeeSettingsSchema = z.object({
  lateFeeEnabled: z.boolean(),
  lateFeeAmount: z.coerce
    .number()
    .min(0, "Late fee can't be negative")
    .max(1_000_000, "Late fee is too large")
    .optional(),
  lateFeeFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  maxLateFeeCap: z.coerce
    .number()
    .positive("Maximum late fee must be greater than zero")
    .max(1_000_000, "Maximum late fee is too large")
    .nullable()
    .optional(),
});

export async function saveLateFeeSettings(data: {
  lateFeeEnabled: boolean;
  lateFeeAmount?: number;
  lateFeeFrequency?: string;
  /** Most late fee a single charge can accrue; null removes the cap. */
  maxLateFeeCap?: number | null;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = lateFeeSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Invalid late fee settings",
    };
  }
  const settings = parsed.data;
  if (settings.lateFeeEnabled && !settings.lateFeeAmount) {
    return { error: "Enter a late fee amount to enable late fees" };
  }

  try {
    await prisma.school.update({
      where: { id: user.schoolId },
      data: {
        lateFeeEnabled: settings.lateFeeEnabled,
        lateFeeAmount:
          settings.lateFeeAmount !== undefined ? settings.lateFeeAmount : null,
        lateFeeFrequency: settings.lateFeeFrequency || "MONTHLY",
        ...(settings.maxLateFeeCap !== undefined
          ? { maxLateFeeCap: settings.maxLateFeeCap }
          : {}),
      },
    });

    // If enabled, ensure the "Late Fee" FeeComponent exists
    if (settings.lateFeeEnabled) {
      const existing = await prisma.feeComponent.findFirst({
        where: { schoolId: user.schoolId, category: "LATE_FEE" },
      });
      if (!existing) {
        await prisma.feeComponent.create({
          data: {
            schoolId: user.schoolId,
            name: "Late Fee",
            category: "LATE_FEE",
            amount: settings.lateFeeAmount || 0,
            frequency: "MONTHLY",
            isOptional: false,
          },
        });
      } else if (Number(existing.amount) !== settings.lateFeeAmount) {
        await prisma.feeComponent.update({
          where: { id: existing.id },
          data: { amount: settings.lateFeeAmount || 0 },
        });
      }
    }

    await invalidateCache(`cache:${user.schoolId}:school:*`);
    await invalidateCache(`cache:${user.schoolId}:feeComponents:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

// -- Automatic Monthly Generation
/** B2: whether the monthly cron generates this school's fees automatically. */
export async function saveFeeAutomationSettings(data: {
  autoFeeGeneration: boolean;
}) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };
  if (typeof data?.autoFeeGeneration !== "boolean") {
    return { error: "Invalid setting" };
  }

  try {
    await prisma.school.update({
      where: { id: user.schoolId },
      data: { autoFeeGeneration: data.autoFeeGeneration },
    });
    await invalidateCache(`cache:${user.schoolId}:school:*`);
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
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
    return { error: actionErrorMessage(e) };
  }
}
