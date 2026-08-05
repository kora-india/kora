"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import type { Prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required").max(60, "Name too long"),
  items: z
    .array(
      z.object({
        name: z.string().min(1, "Fee type name is required"),
        amount: z.coerce.number().nonnegative("Amount must be positive"),
      })
    )
    .min(1, "Add at least one fee line item"),
  classIds: z.array(z.string()).default([]),
});

// Neon's pooled connection is PgBouncer transaction-mode, which can be slow
// to hand out a connection to BEGIN a transaction (especially after the
// compute has been idle) — give it more room than Prisma's 2s default.
const TX_OPTIONS = { maxWait: 10000, timeout: 15000 };

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

// Resolves each line item's fee type name to a FeeType row, creating it if
// it doesn't exist yet so custom types typed here become reusable elsewhere.
// Runs outside any transaction — each upsert is independently safe (the
// unique constraint prevents duplicates), and keeping this off the
// transaction keeps it short enough to reliably start on a pooled connection.
async function resolveFeeTypeIds(schoolId: string, items: { name: string; amount: number }[]) {
  const resolved: { feeTypeId: string; name: string; amount: number }[] = [];
  for (const item of items) {
    const feeType = await prisma.feeType.upsert({
      where: { schoolId_name: { schoolId, name: item.name } },
      update: {},
      create: { schoolId, name: item.name },
    });
    resolved.push({ feeTypeId: feeType.id, name: feeType.name, amount: item.amount });
  }
  return resolved;
}

export async function createFeeStructure(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = FeeStructureSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const items = await resolveFeeTypeIds(user.schoolId, parsed.data.items);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const structure = await tx.feeStructure.create({
        data: {
          schoolId: user.schoolId,
          name: parsed.data.name,
          items: { create: items },
        },
      });
      if (parsed.data.classIds.length > 0) {
        await tx.class.updateMany({
          where: { id: { in: parsed.data.classIds }, schoolId: user.schoolId },
          data: { feeStructureId: structure.id },
        });
      }
    }, TX_OPTIONS);
    revalidatePath("/settings/fee-structures");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002") return { error: `A fee structure named "${parsed.data.name}" already exists` };
    return { error: e.message };
  }
}

export async function updateFeeStructure(structureId: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = FeeStructureSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const structure = await prisma.feeStructure.findFirst({
      where: { id: structureId, schoolId: user.schoolId },
    });
    if (!structure) return { error: "Fee structure not found" };

    const items = await resolveFeeTypeIds(user.schoolId, parsed.data.items);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.feeStructureItem.deleteMany({ where: { feeStructureId: structureId } });
      await tx.feeStructure.update({
        where: { id: structureId },
        data: { name: parsed.data.name, items: { create: items } },
      });

      // Unassign classes no longer selected, assign the newly selected ones.
      await tx.class.updateMany({
        where: { schoolId: user.schoolId, feeStructureId: structureId, id: { notIn: parsed.data.classIds } },
        data: { feeStructureId: null },
      });
      if (parsed.data.classIds.length > 0) {
        await tx.class.updateMany({
          where: { id: { in: parsed.data.classIds }, schoolId: user.schoolId },
          data: { feeStructureId: structureId },
        });
      }
    }, TX_OPTIONS);
    revalidatePath("/settings/fee-structures");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002") return { error: `A fee structure named "${parsed.data.name}" already exists` };
    return { error: e.message };
  }
}

export async function deleteFeeStructure(structureId: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeStructure.delete({ where: { id: structureId, schoolId: user.schoolId } });
    revalidatePath("/settings/fee-structures");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
