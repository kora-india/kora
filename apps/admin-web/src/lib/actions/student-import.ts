"use server";

import { z } from "zod";
import { prisma } from "@schoolos/db";
import { requirePermission } from "@/lib/auth-guard";
import { checkClassLimit } from "@/lib/plan-limits";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { getPlan } from "@/lib/plans";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/redis";
import {
  admissionNumberCandidates,
  admissionSettingsFor,
} from "@/lib/admission-number";
import {
  classMatchKey,
  displayOrderForClassName,
  parseImportDate,
} from "@/lib/student-import-helpers";
import { actionErrorMessage } from "@/lib/action-errors";

const importStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  parentName: z.string().min(1, "Parent Name is required"),
  parentPhone: z.string().min(1, "Parent Phone is required"),
  admissionNumber: z.string().nullish(),
  rollNumber: z.string().nullish(),
  dateOfBirth: z.union([z.string(), z.number()]).nullish(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullish().default("MALE"),
});

type ImportRow = z.infer<typeof importStudentSchema> & { rowNumber: number };

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Thrown inside the import transaction to roll everything back. */
class ImportAbort extends Error {}

/**
 * Imports students from a spreadsheet. Rows are checked one by one and every
 * rejected row is reported with its row number (D6); nothing is dropped
 * silently. All writes, including any classes and sections the sheet
 * introduces, happen in one transaction, so a failed import changes nothing.
 */
export async function bulkImportStudents(data: any[]): Promise<ImportResult> {
  const guard = await requirePermission("students", "manage");
  if ("error" in guard) {
    return {
      imported: 0,
      skipped: 0,
      failed: data?.length || 0,
      errors: [guard.error],
    };
  }
  const schoolId = guard.schoolId!;

  // 1. Validate each row's fields
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  let failed = 0;
  data.forEach((row, index) => {
    const parsed = importStudentSchema.safeParse(row);
    if (parsed.success) {
      rows.push({ ...parsed.data, rowNumber: index + 1 });
    } else {
      failed++;
      errors.push(
        `Row ${index + 1}: ${parsed.error.errors
          .map((err) =>
            err.path.length > 0
              ? `${err.path.join(".")}: ${err.message}`
              : err.message,
          )
          .join(" | ")}`,
      );
    }
  });

  if (rows.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      failed,
      errors: [...errors, "No valid records to import"],
    };
  }

  // 2. Work out which classes the sheet needs. "5", "Class 5" and "Grade V"
  //    all match the same class, and a new class is created once.
  const existingClasses = await prisma.class.findMany({
    where: { schoolId },
    include: { sections: true },
  });
  const classById = new Map(existingClasses.map((c) => [c.id, c]));
  const classByKey = new Map(
    existingClasses.map((c) => [classMatchKey(c.name), c]),
  );
  const newClassNames = new Map<string, string>(); // key -> name as first written
  for (const row of rows) {
    if (classById.has(row.classId)) continue;
    const key = classMatchKey(row.classId);
    if (!classByKey.has(key) && !newClassNames.has(key)) {
      newClassNames.set(key, row.classId.trim().replace(/\s+/g, " "));
    }
  }
  if (newClassNames.size > 0) {
    const classLimit = await checkClassLimit(schoolId);
    if (classLimit.current + newClassNames.size > classLimit.max) {
      return {
        imported: 0,
        skipped: 0,
        failed: data.length,
        errors: [
          `Importing requires creating ${newClassNames.size} new classes, which exceeds your ${classLimit.plan} plan limit (${classLimit.current}/${classLimit.max} classes). Upgrade your plan to add more.`,
        ],
      };
    }
  }

  let skipped = 0;

  try {
    const imported = await prisma.$transaction(
      async (tx) => {
        // 3. Create the classes and sections the sheet introduces
        for (const [key, name] of newClassNames) {
          const created = await tx.class.create({
            data: { schoolId, name, grade: displayOrderForClassName(name) },
            include: { sections: true },
          });
          classById.set(created.id, created);
          classByKey.set(key, created);
        }
        const resolved: (ImportRow & { classId: string; sectionId: string })[] =
          [];
        for (const row of rows) {
          const cls =
            classById.get(row.classId) ??
            classByKey.get(classMatchKey(row.classId))!;
          let section = cls.sections.find(
            (s) =>
              s.id === row.sectionId ||
              s.name.toLowerCase() === row.sectionId.trim().toLowerCase(),
          );
          if (!section) {
            section = await tx.section.create({
              data: { schoolId, classId: cls.id, name: row.sectionId.trim() },
            });
            cls.sections.push(section);
          }
          resolved.push({ ...row, classId: cls.id, sectionId: section.id });
        }

        // 4. Check every row against the school's students and the rest of
        //    the file. Admission numbers are unique in the school; roll
        //    numbers only among active students of a section (D4).
        const school = await tx.school.findUniqueOrThrow({
          where: { id: schoolId },
          select: {
            admissionNumberPrefix: true,
            admissionNumberFormat: true,
            nextAdmissionNumber: true,
            subdomain: true,
          },
        });
        const { prefix, format } = admissionSettingsFor(school);
        const needGenerated = resolved.filter((r) => !r.admissionNumber).length;
        const candidates = admissionNumberCandidates(
          format,
          prefix,
          school.nextAdmissionNumber,
          needGenerated + 200,
        );
        const provided = resolved
          .map((r) => r.admissionNumber?.trim())
          .filter((n): n is string => !!n);
        const takenRows = await tx.student.findMany({
          where: {
            schoolId,
            admissionNumber: {
              in: [...provided, ...candidates.map((c) => c.admissionNumber)],
            },
          },
          select: { admissionNumber: true },
        });
        const takenAdmissions = new Set(
          takenRows.map((t) => t.admissionNumber),
        );

        const sectionIds = [...new Set(resolved.map((r) => r.sectionId))];
        const activeInSections = await tx.student.findMany({
          where: { schoolId, isActive: true, sectionId: { in: sectionIds } },
          select: { sectionId: true, rollNumber: true, name: true },
        });
        const rollHolders = new Map<string, string>(); // section|roll -> name
        const maxRoll = new Map<string, number>();
        const trackRoll = (sectionId: string, roll: string, name: string) => {
          rollHolders.set(`${sectionId}|${roll.toLowerCase()}`, name);
          const n = Number.parseInt(roll, 10);
          if (!Number.isNaN(n) && n > (maxRoll.get(sectionId) ?? 0)) {
            maxRoll.set(sectionId, n);
          }
        };
        for (const s of activeInSections) {
          trackRoll(s.sectionId, s.rollNumber, s.name);
        }

        const usedInFile = new Set<string>();
        let candidateIndex = 0;
        let lastSequenceUsed: number | null = null;
        const toImport: any[] = [];

        for (const row of resolved) {
          const dob = parseImportDate(row.dateOfBirth);
          if (dob.error) {
            failed++;
            errors.push(`Row ${row.rowNumber}: Date of birth ${dob.error}`);
            continue;
          }

          let admissionNumber = row.admissionNumber?.trim();
          if (admissionNumber) {
            if (takenAdmissions.has(admissionNumber)) {
              skipped++;
              errors.push(
                `Row ${row.rowNumber}: Skipped, admission number ${admissionNumber} already exists.`,
              );
              continue;
            }
            if (usedInFile.has(admissionNumber)) {
              skipped++;
              errors.push(
                `Row ${row.rowNumber}: Skipped, admission number ${admissionNumber} appears more than once in the file.`,
              );
              continue;
            }
          }

          let rollNumber = row.rollNumber?.trim();
          if (rollNumber) {
            const holder = rollHolders.get(
              `${row.sectionId}|${rollNumber.toLowerCase()}`,
            );
            if (holder) {
              skipped++;
              errors.push(
                `Row ${row.rowNumber}: Skipped, roll number ${rollNumber} is already used by ${holder} in this section.`,
              );
              continue;
            }
          } else {
            rollNumber = String((maxRoll.get(row.sectionId) ?? 0) + 1);
          }

          if (!admissionNumber) {
            while (
              candidateIndex < candidates.length &&
              (takenAdmissions.has(
                candidates[candidateIndex].admissionNumber,
              ) ||
                usedInFile.has(candidates[candidateIndex].admissionNumber))
            ) {
              candidateIndex++;
            }
            const next = candidates[candidateIndex++];
            if (!next) {
              throw new ImportAbort(
                "Couldn't generate enough admission numbers. Raise the next sequence number in admission settings.",
              );
            }
            admissionNumber = next.admissionNumber;
            lastSequenceUsed = next.sequence;
          }

          usedInFile.add(admissionNumber);
          trackRoll(row.sectionId, rollNumber, row.name);
          toImport.push({
            schoolId,
            classId: row.classId,
            sectionId: row.sectionId,
            name: row.name,
            parentName: row.parentName,
            parentPhone: String(row.parentPhone),
            admissionNumber,
            rollNumber,
            dateOfBirth: dob.date,
            gender: row.gender,
            isActive: true,
          });
        }

        if (toImport.length === 0) return 0;

        // 5. Plan limit, counted inside the transaction
        const plan = await tx.school.findUniqueOrThrow({
          where: { id: schoolId },
          select: { plan: true },
        });
        const { name: planName, limits } = getPlan(
          await getPlanCatalog(),
          plan.plan,
        );
        const activeStudents = await tx.student.count({
          where: { schoolId, isActive: true },
        });
        if (activeStudents + toImport.length > limits.maxStudents) {
          throw new ImportAbort(
            `Importing ${toImport.length} students would exceed your ${planName} plan limit (${activeStudents}/${limits.maxStudents} active students). Upgrade your plan to add more.`,
          );
        }

        // No skipDuplicates: every row was checked, so a conflict here is a
        // real error and must fail the import rather than drop students.
        await tx.student.createMany({ data: toImport });
        if (lastSequenceUsed !== null) {
          await tx.school.updateMany({
            where: {
              id: schoolId,
              nextAdmissionNumber: { lte: lastSequenceUsed },
            },
            data: { nextAdmissionNumber: lastSequenceUsed + 1 },
          });
        }
        return toImport.length;
      },
      { maxWait: 10000, timeout: 60000 },
    );

    if (imported > 0) {
      await Promise.all([
        invalidateCache(`cache:${schoolId}:students:*`),
        invalidateCache(`cache:${schoolId}:classes:*`),
        invalidateCache(`cache:${schoolId}:dashboard`),
        invalidateCache(`cache:${schoolId}:analytics`),
      ]);
      revalidatePath("/students");
      revalidatePath("/fees");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
    }

    return { imported, skipped, failed, errors };
  } catch (error: any) {
    const message =
      error instanceof ImportAbort
        ? error.message
        : `Import failed and nothing was saved: ${actionErrorMessage(error, "an unexpected error")}`;
    return {
      imported: 0,
      skipped: 0,
      failed: data.length,
      errors: [...errors, message],
    };
  }
}
