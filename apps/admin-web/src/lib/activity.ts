// Writes the activity log (the ledger's Activity tab). Not a "use server"
// module: its exports are helpers, and must not become callable endpoints.

import { headers } from "next/headers";
import { prisma, Prisma } from "@schoolos/db";
import { formatCurrency } from "@schoolos/utils";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders } from "@/lib/ip";
import { SYSTEM_ROLE, type ActivityModule } from "@/lib/activity-labels";

/** Who did it: the session user, or `SYSTEM_ACTOR` for automatic jobs. */
export type ActivityActor = {
  id: string | null;
  name: string;
  role: string;
  schoolId?: string | null;
};

export const SYSTEM_ACTOR: ActivityActor = {
  id: null,
  name: "System",
  role: SYSTEM_ROLE,
};

export type ActivityEntry = {
  /** Such as "payment.collect": the module, then what was done. */
  action: string;
  module: ActivityModule;
  /** One line a school admin reads, such as "Collected ₹5,000 from Rahul". */
  summary: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  /** The school it happened in; the actor's school if left out. */
  schoolId?: string | null;
};

/** "₹5,000", for summaries. */
export const money = (amount: unknown) => formatCurrency(Number(amount) || 0);

/** "Grade 5-A", for summaries. Class names already read "Grade 5". */
export const classLabel = (
  className?: string | null,
  section?: string | null,
) => `${className ?? "Unknown class"}${section ? `-${section}` : ""}`;

async function requestInfo() {
  try {
    const h = await headers();
    const ip = clientIpFromHeaders(h);
    return {
      ip: ip === "unknown" ? null : ip,
      userAgent: h.get("user-agent")?.slice(0, 300) || null,
    };
  } catch {
    // Outside a request (scripts, tests).
    return { ip: null, userAgent: null };
  }
}

/**
 * Adds a row to the activity log. Never throws: the change it records has
 * already been saved, so a failure here is logged, not passed on.
 */
export async function logActivity(
  actor: ActivityActor,
  entry: ActivityEntry,
): Promise<void> {
  try {
    const { ip, userAgent } = await requestInfo();
    await prisma.activityLog.create({
      data: {
        schoolId:
          entry.schoolId !== undefined
            ? entry.schoolId
            : (actor.schoolId ?? null),
        actorId: actor.id,
        actorName: actor.name || "Unknown",
        actorRole: actor.role,
        action: entry.action,
        module: entry.module,
        summary: entry.summary.slice(0, 500),
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        details: entry.details
          ? (JSON.parse(JSON.stringify(entry.details)) as Prisma.InputJsonValue)
          : undefined,
        ip,
        userAgent,
      },
    });
  } catch (e) {
    logger.error("Activity log write failed", {
      action: entry.action,
      error: String(e),
    });
  }
}
