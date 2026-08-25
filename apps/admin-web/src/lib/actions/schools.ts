"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import type { Prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import { invalidateCache } from "@/lib/redis";

const CreateSchoolSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters"),
  subdomain: z
    .string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(40, "Subdomain too long")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens allowed"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  plan: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]).default("FREE"),
  adminName: z.string().min(2, "Admin name required"),
  adminEmail: z.string().email("Valid admin email required"),
  seedDefaultClasses: z.boolean().default(false),
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function getSuperAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (user.role !== "SUPER_ADMIN") return null;
  return user;
}

export async function createSchool(data: unknown) {
  const user = await getSuperAdminSession();
  if (!user) return { error: "Unauthorized — Super Admin access required" };

  const parsed = CreateSchoolSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { name, subdomain, address, phone, email, plan, adminName, adminEmail, seedDefaultClasses } = parsed.data;

  // Check subdomain uniqueness before transaction
  const existing = await prisma.school.findUnique({ where: { subdomain } });
  if (existing) return { error: `Subdomain "${subdomain}" is already taken` };

  // Check admin email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) return { error: `A user with email "${adminEmail}" already exists` };

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  try {
    // Neon's pooled connection is PgBouncer transaction-mode, which can be slow
    // to hand out a connection to BEGIN a transaction — give it more room than
    // Prisma's 2s default, especially with seedDefaultClasses' ~21 sequential creates.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create school
      const school = await tx.school.create({
        data: {
          name,
          subdomain,
          address: address || null,
          phone: phone || null,
          email: email || null,
          plan: plan as any,
          isActive: true,
        },
      });

      // Create school admin user
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          password: hashedPassword,
          role: "SCHOOL_ADMIN",
          schoolId: school.id,
        },
      });

      // Optionally seed default classes
      if (seedDefaultClasses) {
        const defaultGrades = [6, 7, 8, 9, 10, 11, 12];
        for (const grade of defaultGrades) {
          const cls = await tx.class.create({
            data: { schoolId: school.id, name: `Grade ${grade}`, grade },
          });
          // Create sections A and B
          for (const sName of ["A", "B"]) {
            await tx.section.create({
              data: { schoolId: school.id, classId: cls.id, name: sName },
            });
          }
        }
      }

      return { school, adminUser };
    }, { maxWait: 10000, timeout: 15000 });

    logger.info("School created", { schoolId: result.school.id, subdomain, plan, createdBy: user.id });

    revalidatePath("/schools");
    return {
      success: true,
      schoolId: result.school.id,
      adminEmail,
      tempPassword,
      message: `School "${name}" created successfully.`,
    };
  } catch (e: any) {
    logger.error("School creation failed", { error: e.message, subdomain });
    if (e.code === "P2002") return { error: "A school with this subdomain or email already exists" };
    return { error: "Failed to create school. Please try again." };
  }
}

export async function toggleSchoolStatus(schoolId: string) {
  const user = await getSuperAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return { error: "School not found" };

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data: { isActive: !school.isActive },
    });

    logger.info("School status toggled", {
      schoolId,
      newStatus: updated.isActive ? "active" : "suspended",
      toggledBy: user.id,
    });

    await invalidateCache(`cache:${schoolId}:school:*`);
    await invalidateCache(`cache:${schoolId}:dashboard`);

    revalidatePath("/schools");
    return {
      success: true,
      isActive: updated.isActive,
      message: updated.isActive
        ? `"${school.name}" has been reactivated.`
        : `"${school.name}" has been suspended.`,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function updateSchoolPlan(schoolId: string, plan: string) {
  const user = await getSuperAdminSession();
  if (!user) return { error: "Unauthorized" };

  const validPlans = ["FREE", "BASIC", "PRO", "ENTERPRISE"];
  if (!validPlans.includes(plan)) return { error: "Invalid plan" };

  try {
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { plan: plan as any },
    });

    logger.info("School plan updated", { schoolId, plan, updatedBy: user.id });
    await invalidateCache(`cache:${schoolId}:school:*`);
    await invalidateCache(`cache:${schoolId}:dashboard`);
    revalidatePath("/schools");
    return { success: true, message: `Plan updated to ${plan}` };
  } catch (e: any) {
    return { error: e.message };
  }
}
