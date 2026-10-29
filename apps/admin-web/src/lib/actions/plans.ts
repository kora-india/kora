"use server";

import { prisma } from "@schoolos/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { invalidateSuperAdminCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity } from "@/lib/activity";
import { getSuperAdminSession } from "@/lib/actions/super-admin";
import {
  PLAN_CATALOG_TAG,
  buildPlanCatalog,
  readPlanRows,
} from "@/lib/plan-catalog";
import { applyPlanInput, parsePlanInput, planToRow } from "@/lib/plan-input";
import { PLAN_IDS, isPlanId } from "@/lib/plans";

/**
 * Saves one plan as the super admin edited it (U1). Every plan gets a row
 * the first time, so the catalogue lives in one place; after that only the
 * edited plan changes, apart from clearing "most popular" on the others.
 * New prices apply to the next checkout; limits and modules apply to every
 * school on the plan at once.
 */
export async function updatePlan(planId: string, input: unknown) {
  const user = await getSuperAdminSession();
  if (!user) return { error: "Unauthorized" };
  if (!isPlanId(planId)) return { error: "Invalid plan" };

  const parsed = parsePlanInput(planId, input);
  if ("error" in parsed) return { error: parsed.error };

  try {
    await prisma.$transaction(async (tx) => {
      const { configs, legacyLimits } = await readPlanRows(tx);
      const next = applyPlanInput(
        buildPlanCatalog(configs, legacyLimits),
        planId,
        parsed.data,
      );
      for (const id of PLAN_IDS) {
        const row = planToRow(next[id]);
        await tx.planConfig.upsert({
          where: { plan: id },
          create: { plan: id, ...row, updatedBy: user.id },
          update:
            id === planId
              ? { ...row, updatedBy: user.id }
              : { popular: row.popular },
        });
      }
    });
  } catch (e) {
    return { error: actionErrorMessage(e) };
  }

  logger.info("Plan updated", { plan: planId, updatedBy: user.id });
  revalidateTag(PLAN_CATALOG_TAG);
  // Every page that shows plans, including the prerendered landing page.
  revalidatePath("/", "layout");
  await invalidateSuperAdminCache();
  await logActivity(user, {
    schoolId: null,
    action: "plan.update",
    module: "subscription",
    summary: `Edited the ${parsed.data.name} plan`,
    entityType: "PlanConfig",
    entityId: planId,
  });
  return { success: true, message: `${parsed.data.name} plan saved` };
}
