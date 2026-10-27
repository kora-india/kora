import { unstable_cache } from "next/cache";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import {
  DEFAULT_PLANS,
  PLAN_IDS,
  PLAN_MODULES,
  isPlanId,
  type FeatureKey,
  type PlanCatalog,
} from "@/lib/plans";

/**
 * The live plan catalogue (U1), on the server. Saved `plan_configs` rows
 * replace the defaults; older `plan_limits` rows still adjust the limits of
 * plans that were never saved. Cached under `PLAN_CATALOG_TAG`, which the
 * plan editor revalidates, so a saved plan shows everywhere at once.
 */

export const PLAN_CATALOG_TAG = "plan-catalog";

const logger = createLogger("plan-catalog");

export interface PlanConfigRow {
  plan: string;
  name: string;
  tagline: string;
  monthlyPriceInr: number;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
  modules: string[];
  benefits: string[];
  popular: boolean;
}

export interface LegacyLimitRow {
  plan: string;
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
}

const MODULE_KEYS: string[] = PLAN_MODULES.map((m) => m.key);
const isFeatureKey = (key: string): key is FeatureKey =>
  MODULE_KEYS.includes(key);

export function buildPlanCatalog(
  configs: PlanConfigRow[],
  legacyLimits: LegacyLimitRow[] = [],
): PlanCatalog {
  const plans = Object.fromEntries(
    PLAN_IDS.map((id) => [
      id,
      { ...DEFAULT_PLANS[id], limits: { ...DEFAULT_PLANS[id].limits } },
    ]),
  ) as PlanCatalog;

  for (const row of legacyLimits) {
    if (!isPlanId(row.plan)) continue;
    plans[row.plan].limits = {
      maxStudents: row.maxStudents,
      maxTeachers: row.maxTeachers,
      maxClasses: row.maxClasses,
    };
  }

  for (const row of configs) {
    if (!isPlanId(row.plan)) continue;
    plans[row.plan] = {
      id: row.plan,
      name: row.name,
      tagline: row.tagline,
      monthlyPriceInr: row.monthlyPriceInr,
      limits: {
        maxStudents: row.maxStudents ?? Infinity,
        maxTeachers: row.maxTeachers ?? Infinity,
        maxClasses: row.maxClasses ?? Infinity,
      },
      modules: row.modules.filter(isFeatureKey),
      features: row.benefits,
      popular: row.popular,
    };
  }
  return plans;
}

const configSelect = {
  plan: true,
  name: true,
  tagline: true,
  monthlyPriceInr: true,
  maxStudents: true,
  maxTeachers: true,
  maxClasses: true,
  modules: true,
  benefits: true,
  popular: true,
} as const;

const legacySelect = {
  plan: true,
  maxStudents: true,
  maxTeachers: true,
  maxClasses: true,
} as const;

type PlanReader = Pick<typeof prisma, "planConfig" | "planLimit">;

/** Reads the saved rows, uncached (the editor reads inside its transaction). */
export async function readPlanRows(db: PlanReader = prisma) {
  const [configs, legacyLimits] = await Promise.all([
    db.planConfig.findMany({ select: configSelect }),
    db.planLimit.findMany({ select: legacySelect }),
  ]);
  return { configs, legacyLimits };
}

// The rows, not the catalogue, are cached: unlimited is Infinity in the
// catalogue, which doesn't survive the cache's JSON.
const cachedPlanRows = unstable_cache(() => readPlanRows(), ["plan-catalog"], {
  tags: [PLAN_CATALOG_TAG],
  revalidate: 300,
});

export async function getPlanCatalog(): Promise<PlanCatalog> {
  try {
    const { configs, legacyLimits } = await cachedPlanRows();
    return buildPlanCatalog(configs, legacyLimits);
  } catch (err) {
    // Not cached, so the next request tries the database again.
    logger.error({ err }, "Plan catalogue unavailable; using the defaults");
    return buildPlanCatalog([]);
  }
}
