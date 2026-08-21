"use server";

import { auth } from "@schoolos/auth";
import { prisma, PaymentMethod } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCache, invalidateCache } from "@/lib/redis";

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
  paymentMethod: z.enum(["CASH", "ONLINE", "CHEQUE", "UPI"]),
  referenceNo: z.string().optional(),
});

async function getFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
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
    if (e.code === "P2002") return { error: "Category with this name already exists" };
    return { error: e.message };
  }
}

export async function createExpense(data: unknown) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = ExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    const expense = await prisma.expense.create({
      data: {
        ...parsed.data,
        schoolId: user.schoolId,
        date: new Date(parsed.data.date),
        recordedById: user.id,
      },
    });
    
    await invalidateCache(`cache:${user.schoolId}:expenses:list`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    
    return { success: true, id: expense.id };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteExpense(id: string) {
  const user = await getFinanceSession();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.expense.delete({
      where: { id, schoolId: user.schoolId },
    });
    
    await invalidateCache(`cache:${user.schoolId}:expenses:list`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
