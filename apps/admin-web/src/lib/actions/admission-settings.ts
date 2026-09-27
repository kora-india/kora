"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCache } from "@/lib/redis";
import { formatAdmissionNumber } from "@/lib/admission-number";

const AdmissionSettingsSchema = z.object({
  prefix: z
    .string()
    .min(1, "Prefix is required")
    .max(20, "Prefix must be at most 20 characters")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Prefix can only contain letters, numbers, hyphens, and underscores",
    ),
  format: z
    .string()
    .min(3, "Format is required")
    .refine((fmt) => /\{SEQ(?::\d+)?\}/i.test(fmt), {
      message:
        "Format template must include {SEQ} or {SEQ:4} for unique student numbering",
    }),
  nextSequence: z.coerce
    .number()
    .int()
    .min(1, "Sequence must be at least 1")
    .default(1),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function getAdmissionNumberSettings() {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        admissionNumberPrefix: true,
        admissionNumberFormat: true,
        nextAdmissionNumber: true,
      },
    });

    if (!school) return { error: "School not found" };

    const defaultPrefix =
      school.admissionNumberPrefix ||
      school.subdomain
        ?.replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 4)
        .toUpperCase() ||
      "SCH";
    const defaultFormat =
      school.admissionNumberFormat || "{PREFIX}-{YYYY}-{SEQ:4}";
    const nextSequence = school.nextAdmissionNumber ?? 1;

    const sample = formatAdmissionNumber(
      defaultFormat,
      defaultPrefix,
      nextSequence,
    );

    return {
      success: true,
      settings: {
        prefix: defaultPrefix,
        format: defaultFormat,
        nextSequence,
        samplePreview: sample,
      },
    };
  } catch (err: any) {
    return { error: err.message || "Failed to load admission number settings" };
  }
}

export async function saveAdmissionNumberSettings(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = AdmissionSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: parsed.error.errors[0]?.message || "Invalid settings input",
    };
  }

  const { prefix, format, nextSequence } = parsed.data;

  try {
    const cleanPrefix = prefix.trim().toUpperCase();
    const cleanFormat = format.trim();

    await prisma.school.update({
      where: { id: user.schoolId },
      data: {
        admissionNumberPrefix: cleanPrefix,
        admissionNumberFormat: cleanFormat,
        nextAdmissionNumber: Math.max(1, nextSequence),
      },
    });

    await invalidateCache(`cache:${user.schoolId}:school:*`);
    await invalidateCache(`cache:${user.schoolId}:students:*`);

    revalidatePath("/settings");
    revalidatePath("/settings/school-profile");
    revalidatePath("/students");

    return {
      success: true,
      sample: formatAdmissionNumber(cleanFormat, cleanPrefix, nextSequence),
    };
  } catch (err: any) {
    return { error: err.message || "Failed to save admission number format" };
  }
}

export async function getNextAdmissionNumber(
  overrideFormat?: string,
  overridePrefix?: string,
) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        admissionNumberPrefix: true,
        admissionNumberFormat: true,
        nextAdmissionNumber: true,
      },
    });

    if (!school) return { error: "School not found" };

    const prefix =
      overridePrefix?.trim().toUpperCase() ||
      school.admissionNumberPrefix ||
      school.subdomain
        ?.replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 4)
        .toUpperCase() ||
      "SCH";

    const format =
      overrideFormat?.trim() ||
      school.admissionNumberFormat ||
      "{PREFIX}-{YYYY}-{SEQ:4}";

    let sequence = Math.max(1, school.nextAdmissionNumber ?? 1);
    let candidate = formatAdmissionNumber(format, prefix, sequence);

    // Collision check: verify candidate doesn't already belong to an enrolled student
    // Check up to 100 consecutive numbers to guarantee uniqueness
    for (let attempts = 0; attempts < 100; attempts++) {
      const existing = await prisma.student.findFirst({
        where: {
          admissionNumber: candidate,
        },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      sequence += 1;
      candidate = formatAdmissionNumber(format, prefix, sequence);
    }

    return {
      success: true,
      admissionNumber: candidate,
      sequence,
      prefix,
      format,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to generate next admission number" };
  }
}
