"use server";

import { prisma } from "@schoolos/db";
import { requirePermission } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { invalidateFeesCache } from "@/lib/redis";
import { processClassFeeGeneration } from "@/lib/services/fee-generation-service";
import {
  formatPeriodLabel,
  isPeriodKey,
  periodKeyFromDate,
} from "@/lib/fees/billing-period";
import { logActivity } from "@/lib/activity";

async function getFinanceSession() {
  const guard = await requirePermission("fees", "manage");
  if ("error" in guard) return null;
  return { ...guard, schoolId: guard.schoolId! };
}

export async function generateMonthlyFees(
  sessionId: string,
  classIds: string[] | string,
  monthTitle: string,
  dueDateStr: string,
  billingMonth?: string,
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

  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate.getTime())) return { error: "Enter a valid due date" };

  // The billing month identifies the charge; older callers only sent a due
  // date, so fall back to its month.
  const periodKey = isPeriodKey(billingMonth)
    ? billingMonth
    : periodKeyFromDate(dueDate);
  const title = monthTitle.trim() || formatPeriodLabel(periodKey);

  let totalGenerated = 0;
  let totalAlreadyGenerated = 0;
  const errors: { classId: string; error: string }[] = [];

  for (const cId of uniqueIds) {
    const res = await processClassFeeGeneration(user.schoolId, sessionId, cId, {
      periodKey,
      title,
      dueDate,
    });

    if (res.error) {
      errors.push({ classId: cId, error: res.error });
    } else {
      totalGenerated += res.generatedCount ?? 0;
      totalAlreadyGenerated += res.alreadyGenerated ?? 0;
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

  if (totalGenerated > 0) {
    await logActivity(user, {
      action: "fee.generate",
      module: "fees",
      summary: `Generated ${totalGenerated} fee bill${totalGenerated === 1 ? "" : "s"} for ${title} (${uniqueIds.length} class${uniqueIds.length === 1 ? "" : "es"})`,
      details: {
        periodKey,
        sessionId,
        classIds: uniqueIds,
        alreadyGenerated: totalAlreadyGenerated,
      },
    });
  }

  return {
    success: true,
    generatedCount: totalGenerated,
    alreadyGeneratedCount: totalAlreadyGenerated,
    periodKey,
    skippedOrErrors: errors.length > 0 ? errors : undefined,
  };
}
