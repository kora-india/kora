"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FeeTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(60, "Name too long"),
  defaultAmount: z.coerce.number().nonnegative("Amount must be positive").optional().or(z.literal("")),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function createFeeType(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = FeeTypeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.feeType.create({
      data: {
        schoolId: user.schoolId,
        name: parsed.data.name,
        defaultAmount: parsed.data.defaultAmount === "" || parsed.data.defaultAmount == null
          ? null
          : parsed.data.defaultAmount,
      },
    });
    revalidatePath("/settings/fee-types");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002") return { error: `A fee type named "${parsed.data.name}" already exists` };
    return { error: e.message };
  }
}

export async function updateFeeType(feeTypeId: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = FeeTypeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.feeType.update({
      where: { id: feeTypeId, schoolId: user.schoolId },
      data: {
        name: parsed.data.name,
        defaultAmount: parsed.data.defaultAmount === "" || parsed.data.defaultAmount == null
          ? null
          : parsed.data.defaultAmount,
      },
    });
    revalidatePath("/settings/fee-types");
    return { success: true };
  } catch (e: any) {
    if (e.code === "P2002") return { error: `A fee type named "${parsed.data.name}" already exists` };
    return { error: e.message };
  }
}

export async function toggleFeeTypeActive(feeTypeId: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const feeType = await prisma.feeType.findFirst({
      where: { id: feeTypeId, schoolId: user.schoolId },
    });
    if (!feeType) return { error: "Fee type not found" };

    await prisma.feeType.update({
      where: { id: feeTypeId },
      data: { isActive: !feeType.isActive },
    });
    revalidatePath("/settings/fee-types");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteFeeType(feeTypeId: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.feeType.delete({ where: { id: feeTypeId, schoolId: user.schoolId } });
    revalidatePath("/settings/fee-types");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
