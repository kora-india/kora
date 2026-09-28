"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkClassLimit, planLimitMessage } from "@/lib/plan-limits";
import { invalidateCache } from "@/lib/redis";
import {
  CLASS_NAME_MAX,
  DISPLAY_ORDER_MAX,
  DISPLAY_ORDER_MIN,
  normalizeName,
} from "@/lib/class-catalog";

// `grade` is the class's display order: Nursery -2, LKG -1, UKG 0, Grade N = N.
const ClassSchema = z.object({
  name: z
    .string()
    .transform(normalizeName)
    .pipe(
      z
        .string()
        .min(1, "Class name is required")
        .max(
          CLASS_NAME_MAX,
          `Class name must be at most ${CLASS_NAME_MAX} characters`,
        ),
    ),
  grade: z.coerce
    .number()
    .int("Display order must be a whole number")
    .min(DISPLAY_ORDER_MIN)
    .max(DISPLAY_ORDER_MAX),
  classTeacherId: z.string().optional().nullable(),
  initialSections: z.union([z.array(z.string()), z.string()]).optional(),
});

const SectionSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Section name is required"),
});

const CreateSectionsSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  names: z
    .union([z.array(z.string()), z.string()])
    .transform((val) => {
      if (Array.isArray(val)) {
        return val.map((s) => s.trim()).filter((s) => s.length > 0);
      }
      return val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    })
    .refine((arr) => arr.length > 0, "At least one section name is required"),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function createClass(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ClassSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const limit = await checkClassLimit(user.schoolId);
  if (!limit.allowed) {
    return {
      error: planLimitMessage("classes", limit.current, limit.max, limit.plan),
    };
  }

  try {
    const existing = await prisma.class.findFirst({
      where: {
        schoolId: user.schoolId,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { name: true },
    });
    if (existing) {
      return {
        error: `${existing.name} already exists. You can add or manage sections from the existing class.`,
      };
    }

    const cls = await prisma.class.create({
      data: {
        name: parsed.data.name,
        grade: parsed.data.grade,
        classTeacherId: parsed.data.classTeacherId || null,
        schoolId: user.schoolId,
      },
    });

    if (parsed.data.initialSections) {
      const raw = parsed.data.initialSections;
      const rawNames = Array.isArray(raw) ? raw : raw.split(",");
      const sectionNames = rawNames
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 20);

      const uniqueNames: string[] = [];
      const seen = new Set<string>();
      for (const name of sectionNames) {
        const lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          uniqueNames.push(name);
        }
      }

      if (uniqueNames.length > 0) {
        await prisma.section.createMany({
          data: uniqueNames.map((name) => ({
            name,
            classId: cls.id,
            schoolId: user.schoolId,
          })),
          skipDuplicates: true,
        });
      }
    }

    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/classes");
    revalidatePath("/fees");
    revalidatePath("/students");
    revalidatePath("/teachers");
    revalidatePath("/dashboard");
    return { success: true, id: cls.id };
  } catch (e: any) {
    if (e.code === "P2002")
      return {
        error: `${parsed.data.name} already exists. You can add or manage sections from the existing class.`,
      };
    return { error: e.message };
  }
}

export async function updateClass(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ClassSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const clash = await prisma.class.findFirst({
      where: {
        schoolId: user.schoolId,
        id: { not: id },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { name: true },
    });
    if (clash) return { error: `${clash.name} already exists` };

    await prisma.class.update({
      where: { id, schoolId: user.schoolId },
      data: {
        name: parsed.data.name,
        grade: parsed.data.grade,
        classTeacherId: parsed.data.classTeacherId || null,
      },
    });
    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    revalidatePath("/classes");
    revalidatePath("/fees");
    revalidatePath("/students");
    revalidatePath("/teachers");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002")
      return { error: "A class with this name already exists" };
    return { error: e.message };
  }
}

export async function deleteClass(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.class.delete({ where: { id, schoolId: user.schoolId } });
    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    await invalidateCache(`cache:${user.schoolId}:feeStructures:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/classes");
    revalidatePath("/fees");
    revalidatePath("/students");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e: any) {
    return { error: "Cannot delete class with existing students or sections" };
  }
}

export async function createSection(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = SectionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const cls = await prisma.class.findFirst({
      where: { id: parsed.data.classId, schoolId: user.schoolId },
    });
    if (!cls) return { error: "Class not found" };

    const section = await prisma.section.create({
      data: { ...parsed.data, schoolId: user.schoolId },
    });
    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    revalidatePath("/classes");
    revalidatePath("/students");
    return { success: true, id: section.id };
  } catch (e: any) {
    if (e.code === "P2002")
      return { error: "Section already exists in this class" };
    return { error: e.message };
  }
}

export async function createSections(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = CreateSectionsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const cls = await prisma.class.findFirst({
      where: { id: parsed.data.classId, schoolId: user.schoolId },
      include: { sections: { select: { name: true } } },
    });
    if (!cls) return { error: "Class not found" };

    const uniqueNames: string[] = [];
    const seen = new Set<string>();
    for (const name of parsed.data.names) {
      if (name.length > 20) {
        return { error: `Section name "${name}" exceeds 20 characters` };
      }
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueNames.push(name);
      }
    }

    const existingNames = new Set(
      cls.sections.map((s) => s.name.toLowerCase()),
    );
    const toCreate = uniqueNames.filter(
      (name) => !existingNames.has(name.toLowerCase()),
    );
    const skipped = uniqueNames.filter((name) =>
      existingNames.has(name.toLowerCase()),
    );

    if (toCreate.length === 0) {
      return {
        error:
          uniqueNames.length === 1
            ? `Section "${uniqueNames[0]}" already exists in this class`
            : "All specified sections already exist in this class",
      };
    }

    await prisma.section.createMany({
      data: toCreate.map((name) => ({
        name,
        classId: parsed.data.classId,
        schoolId: user.schoolId,
      })),
      skipDuplicates: true,
    });

    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    revalidatePath("/classes");
    revalidatePath("/students");
    revalidatePath("/teachers");
    revalidatePath("/timetable");

    return {
      success: true,
      count: toCreate.length,
      created: toCreate,
      skipped,
    };
  } catch (e: any) {
    if (e.code === "P2002")
      return { error: "Section already exists in this class" };
    return { error: e.message || "Failed to create sections" };
  }
}

export async function deleteSection(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.section.delete({ where: { id, schoolId: user.schoolId } });
    await invalidateCache(`cache:${user.schoolId}:classes:*`);
    revalidatePath("/classes");
    revalidatePath("/students");
    return { success: true };
  } catch (e: any) {
    return { error: "Cannot delete section with existing students" };
  }
}
