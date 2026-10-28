"use server";

import { isError, requirePermission } from "@/lib/auth-guard";
import { prisma, PaymentMethod } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCache, invalidateCache, invalidateLedgerCache } from "@/lib/redis";
import { actionErrorMessage } from "@/lib/action-errors";

const ExpenseCategorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
});

const ExpenseSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  // U13: every method the database accepts, not just four of them.
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNo: z.string().optional(),
});

async function getFinanceSession() {
  const access = await requirePermission("expenses", "manage");
  return isError(access) ? null : access;
}

export async function createExpenseCategory(data: unknown) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ExpenseCategorySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const category = await prisma.expenseCategory.create({
      data: {
        ...parsed.data,
        schoolId: user.schoolId,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:expenses:categories`);
    revalidatePath("/expenses");

    return { success: true, id: category.id };
  } catch (e: any) {
    if (e.code === "P2002")
      return { error: "Category with this name already exists" };
    return { error: actionErrorMessage(e) };
  }
}

export async function createExpense(data: unknown) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const category = await prisma.expenseCategory.findFirst({
    where: { id: parsed.data.categoryId, schoolId: user.schoolId },
  });
  if (!category) return { error: "Expense category not found in your school" };

  try {
    const expense = await prisma.expense.create({
      data: {
        ...parsed.data,
        schoolId: user.schoolId,
        date: new Date(parsed.data.date),
        recordedById: user.id,
      },
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:expenses:list`),
      invalidateLedgerCache(user.schoolId),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");

    return { success: true, id: expense.id };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

export async function deleteExpense(id: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.expense.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) return { error: "Expense not found in your school" };
    // Salaries are recorded by payroll; deleting one here would leave the
    // teacher paid with no money out.
    if (existing.referenceNo) {
      const payout = await prisma.payrollPayout.findFirst({
        where: { schoolId: user.schoolId, transactionId: existing.referenceNo },
        select: { id: true },
      });
      if (payout) {
        return {
          error:
            "This is a salary payout recorded by payroll, so it can't be deleted here.",
        };
      }
    }

    await prisma.expense.delete({
      where: { id: existing.id },
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:expenses:list`),
      invalidateLedgerCache(user.schoolId),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");

    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
