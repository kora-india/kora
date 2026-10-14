"use server";

import { prisma } from "@schoolos/db";
import { requireActiveSchoolSession } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { invalidateFeesCache } from "@/lib/redis";
import { processClassFeeGeneration } from "@/lib/services/fee-generation-service";

async function getFinanceSession() {
  const guard = await requireActiveSchoolSession([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "ACCOUNTANT",
  ]);
  if ("error" in guard) return null;
  return { ...guard, schoolId: guard.schoolId! };
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

  const session = await prisma.academicSession.findFirst({
    where: { id: sessionId, schoolId: user.schoolId },
  });
  if (!session) return { error: "Academic session not found in your school" };

  const matchingClasses = await prisma.class.findMany({
    where: { id: { in: uniqueIds }, schoolId: user.schoolId },
    select: { id: true },
  });
  if (matchingClasses.length !== uniqueIds.length) {
    return { error: "One or more selected classes not found in your school" };
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
