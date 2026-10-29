"use server";

import { prisma } from "@schoolos/db";
import { isError, requirePermission } from "@/lib/auth-guard";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity } from "@/lib/activity";
import { getLedgerExport, type LedgerRow } from "@/lib/reports/ledger";
import { parseLedgerQuery } from "@/lib/reports/ledger-query";

/** Every ledger row matching the page's filters, for the CSV download. */
export async function exportLedger(
  params: Record<string, string>,
): Promise<
  | { success: true; rows: LedgerRow[]; total: number; timeZone: string | null }
  | { error: string }
> {
  const access = await requirePermission("ledger");
  if (isError(access)) return { error: access.error };

  try {
    const query = parseLedgerQuery(params);
    const school = await prisma.school.findUnique({
      where: { id: access.schoolId },
      select: { timezone: true },
    });
    const { rows, total } = await getLedgerExport(
      access.schoolId,
      query,
      school?.timezone,
    );
    await logActivity(access, {
      action: "ledger.export",
      module: "ledger",
      summary: `Downloaded the ledger as CSV (${rows.length} entr${rows.length === 1 ? "y" : "ies"})`,
      details: { filters: params },
    });
    return {
      success: true,
      rows,
      total,
      timeZone: school?.timezone ?? null,
    };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't export the ledger") };
  }
}
