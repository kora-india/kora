"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FeeSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  classId: z.string().min(1, "Class is required"),
  feeType: z.string().min(1, "Fee type is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  dueDate: z.string().min(1, "Due date is required"),
  remarks: z.string().optional(),
});

const PaymentSchema = z.object({
  feeId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "ONLINE", "CHEQUE", "UPI"]),
  remarks: z.string().optional(),
});

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function createFee(data: unknown) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = FeeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const fee = await prisma.fee.create({
      data: {
        ...parsed.data,
        schoolId: user.schoolId,
        dueDate: new Date(parsed.data.dueDate),
        status: "PENDING",
      },
    });
    revalidatePath("/fees");
    return { success: true, id: fee.id };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function recordPayment(data: unknown) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = PaymentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const fee = await prisma.fee.findFirst({
      where: { id: parsed.data.feeId, schoolId: user.schoolId },
    });
    if (!fee) return { error: "Fee record not found" };

    const receiptNo = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          schoolId: user.schoolId,
          feeId: parsed.data.feeId,
          amount: parsed.data.amount,
          method: parsed.data.method,
          receiptNo,
          remarks: parsed.data.remarks ?? null,
        },
      }),
      prisma.fee.update({
        where: { id: parsed.data.feeId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidAmount: parsed.data.amount,
        },
      }),
    ]);

    revalidatePath("/fees");
    return { success: true, receiptNo };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function updateFeeStatus(feeId: string, status: "PENDING" | "OVERDUE" | "WAIVED") {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.fee.update({
      where: { id: feeId, schoolId: user.schoolId },
      data: { status },
    });
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteFee(feeId: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.fee.delete({ where: { id: feeId, schoolId: user.schoolId } });
    revalidatePath("/fees");
    return { success: true };
  } catch (e: any) {
    return { error: "Cannot delete fee with existing payment records" };
  }
}
