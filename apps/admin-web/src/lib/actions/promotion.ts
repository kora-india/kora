"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@schoolos/db";
import { isError, requireSchoolAdmin } from "@/lib/auth-guard";
import { actionErrorMessage } from "@/lib/action-errors";
import { logger } from "@/lib/logger";
import {
  invalidateClassesCache,
  invalidateDashboardCache,
  invalidateFeesCache,
  invalidateStudentsCache,
  invalidateTransportCache,
} from "@/lib/redis";
import {
  defaultDestination,
  planPromotion,
  summarizePlan,
  type Destination,
  type PlanClass,
  type PromotionAction,
} from "@/lib/promotion";

/**
 * Year-end promotion (Students → Promote students). Only school admins: it
 * moves the whole school at once. Every run is recorded student by student,
 * which keeps past classes on record and lets the latest run be undone.
 */

const DestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CLASS"), classId: z.string().min(1) }),
  z.object({ kind: z.literal("GRADUATE") }),
  z.object({ kind: z.literal("STAY") }),
]);

const PromotionSchema = z.object({
  moves: z
    .array(z.object({ fromClassId: z.string().min(1), to: DestinationSchema }))
    .max(500),
  exceptions: z
    .array(
      z.object({
        studentId: z.string().min(1),
        action: z.enum(["REPEAT", "LEAVE"]),
      }),
    )
    .max(10_000),
  renumber: z.boolean(),
});

async function loadSchool(schoolId: string) {
  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        grade: true,
        sections: { select: { id: true, name: true } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.student.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        admissionNumber: true,
        classId: true,
        sectionId: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return { classes: classes as PlanClass[], students };
}

/** The latest promotion that hasn't been undone, if any. */
async function latestBatch(schoolId: string) {
  const last = await prisma.studentPromotion.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    select: { batchId: true, createdAt: true, undoneAt: true },
  });
  if (!last || last.undoneAt) return null;
  const groups = await prisma.studentPromotion.groupBy({
    by: ["action"],
    where: { schoolId, batchId: last.batchId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(
    groups.map((g) => [g.action, g._count._all]),
  ) as Partial<Record<PromotionAction, number>>;
  return { batchId: last.batchId, createdAt: last.createdAt, counts };
}

/** What the promotion dialog needs: classes, students and default moves. */
export async function getPromotionPlan() {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };

  const { classes, students } = await loadSchool(admin.schoolId);
  const counts = new Map<string, number>();
  for (const s of students)
    counts.set(s.classId, (counts.get(s.classId) ?? 0) + 1);

  return {
    success: true as const,
    classes: classes.map((c) => ({
      ...c,
      studentCount: counts.get(c.id) ?? 0,
      defaultDestination: defaultDestination(c, classes) as Destination,
    })),
    students,
    lastPromotion: await latestBatch(admin.schoolId),
  };
}

async function refreshAfterPromotion(schoolId: string) {
  await Promise.all([
    invalidateStudentsCache(schoolId),
    invalidateClassesCache(schoolId),
    invalidateDashboardCache(schoolId),
    invalidateTransportCache(schoolId),
    invalidateFeesCache(schoolId),
  ]);
  for (const path of [
    "/students",
    "/classes",
    "/dashboard",
    "/transport",
    "/fees",
    "/attendance",
  ]) {
    revalidatePath(path);
  }
}

/** Moves every current student as planned. All or nothing. */
export async function promoteStudents(input: unknown) {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };

  const parsed = PromotionSchema.safeParse(input);
  if (!parsed.success) return { error: "The promotion plan isn't valid" };

  try {
    const { classes, students } = await loadSchool(admin.schoolId);
    const plan = planPromotion(classes, students, parsed.data);
    if ("error" in plan) return { error: plan.error };

    const changed = plan.moves.filter(
      (m) =>
        !m.active ||
        m.to.classId !== m.from.classId ||
        m.to.sectionId !== m.from.sectionId ||
        m.to.rollNumber !== m.from.rollNumber,
    );
    if (changed.length === 0) {
      return { error: "Nothing would change. Choose where classes go first." };
    }

    const batchId = `promo_${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
    const session = await prisma.academicSession.findFirst({
      where: { schoolId: admin.schoolId, isCurrent: true },
      select: { id: true },
    });

    await prisma.$transaction(
      async (tx) => {
        const cancelled = new Map<string, string[]>();
        for (const m of changed) {
          if (!m.active) {
            // A student who leaves no longer rides the bus (as when removed).
            const rides = await tx.studentTransport.findMany({
              where: { studentId: m.studentId, status: "ACTIVE" },
              select: { id: true },
            });
            if (rides.length > 0) {
              await tx.studentTransport.updateMany({
                where: { id: { in: rides.map((r) => r.id) } },
                data: { status: "INACTIVE", endDate: new Date() },
              });
              cancelled.set(
                m.studentId,
                rides.map((r) => r.id),
              );
            }
            await tx.student.update({
              where: { id: m.studentId },
              data: { isActive: false },
            });
          } else {
            await tx.student.update({
              where: { id: m.studentId },
              data: {
                classId: m.to.classId,
                sectionId: m.to.sectionId,
                rollNumber: m.to.rollNumber,
              },
            });
          }
        }

        // Every current student is recorded, so the year's classes are on file.
        await tx.studentPromotion.createMany({
          data: plan.moves.map((m) => ({
            schoolId: admin.schoolId,
            batchId,
            studentId: m.studentId,
            action: m.action,
            fromClassId: m.from.classId,
            fromSectionId: m.from.sectionId,
            fromRollNumber: m.from.rollNumber,
            toClassId: m.to.classId,
            toSectionId: m.to.sectionId,
            toRollNumber: m.to.rollNumber,
            cancelledTransportIds: cancelled.get(m.studentId) ?? [],
            sessionId: session?.id ?? null,
            createdById: admin.id,
          })),
        });
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    const summary = summarizePlan(plan.moves);
    logger.info("Students promoted", {
      schoolId: admin.schoolId,
      batchId,
      by: admin.id,
      ...summary,
    });
    await refreshAfterPromotion(admin.schoolId);
    return { success: true as const, batchId, summary };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

/** Puts every student back where the latest promotion found them. */
export async function undoPromotion(batchId: string) {
  const admin = await requireSchoolAdmin();
  if (isError(admin)) return { error: admin.error };

  try {
    const latest = await latestBatch(admin.schoolId);
    if (!latest || latest.batchId !== batchId) {
      return { error: "Only the latest promotion can be undone" };
    }

    const records = await prisma.studentPromotion.findMany({
      where: { schoolId: admin.schoolId, batchId },
    });
    await prisma.$transaction(
      async (tx) => {
        for (const r of records) {
          await tx.student.update({
            where: { id: r.studentId },
            data: {
              classId: r.fromClassId,
              sectionId: r.fromSectionId,
              rollNumber: r.fromRollNumber,
              isActive: true,
            },
          });
          if (r.cancelledTransportIds.length > 0) {
            await tx.studentTransport.updateMany({
              where: { id: { in: r.cancelledTransportIds } },
              data: { status: "ACTIVE", endDate: null },
            });
          }
        }
        await tx.studentPromotion.updateMany({
          where: { schoolId: admin.schoolId, batchId },
          data: { undoneAt: new Date() },
        });
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    logger.info("Promotion undone", {
      schoolId: admin.schoolId,
      batchId,
      by: admin.id,
      students: records.length,
    });
    await refreshAfterPromotion(admin.schoolId);
    return { success: true as const, restored: records.length };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
