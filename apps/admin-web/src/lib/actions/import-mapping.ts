"use server";

import { z } from "zod";
import { isError, requirePermission } from "@/lib/auth-guard";
import { logger } from "@/lib/logger";
import { aiRatelimit } from "@/lib/ratelimit";
import { suggestImportColumns } from "@/lib/gemini";
import {
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  isImportField,
  type ColumnMapping,
} from "@/lib/student-import-helpers";

const RequestSchema = z.object({
  columns: z
    .array(
      z.object({
        header: z.string().trim().min(1).max(100),
        description: z.string().max(300),
      }),
    )
    .min(1)
    .max(60),
  /** Fields other columns already fill. */
  taken: z.array(z.string()).max(60).default([]),
});

export type ImportMappingSuggestion =
  | { suggestions: ColumnMapping }
  /** No Gemini key on this server: match by hand. */
  | { available: false }
  | { error: string };

/**
 * Gemini's guess at the field for each column the import's rules couldn't
 * place. Only headers and descriptions of the values (describeColumn) are
 * sent, never a student's details. Never throws: without an answer the
 * person matches the columns by hand.
 */
export async function suggestImportMapping(
  input: unknown,
): Promise<ImportMappingSuggestion> {
  const access = await requirePermission("students", "manage");
  if (isError(access)) return { error: access.error };

  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Those columns can't be matched" };
  if (!process.env.GEMINI_API_KEY) return { available: false };

  const { success } = await aiRatelimit.limit(`ai:import:${access.id}`);
  if (!success) {
    return {
      error: "AI matching is busy for your account. Match the columns below.",
    };
  }

  try {
    const answer = await suggestImportColumns(
      parsed.data.columns,
      IMPORT_FIELDS.map((id) => ({ id, label: IMPORT_FIELD_LABELS[id] })),
      parsed.data.taken.filter(isImportField),
    );
    const suggestions: ColumnMapping = {};
    for (const [header, field] of Object.entries(answer)) {
      suggestions[header] = isImportField(field) ? field : null;
    }
    return { suggestions };
  } catch (e) {
    logger.warn("Import column matching failed", {
      schoolId: access.schoolId,
      error: String(e),
    });
    return {
      error: "AI couldn't match the columns right now. Match them below.",
    };
  }
}
