import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { redirect } from "next/navigation";
import { ExpensesContent } from "@/components/expenses/expenses-content";
import { getCache } from "@/lib/redis";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.schoolId) return <div className="p-6">No school assigned.</div>;

  const canEdit = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role);
  if (!canEdit) redirect("/dashboard");

  const categories = await getCache(`cache:${user.schoolId}:expenses:categories`, () => 
    prisma.expenseCategory.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { name: "asc" },
    })
  );

  const expenses = await getCache(`cache:${user.schoolId}:expenses:list`, () => 
    prisma.expense.findMany({
      where: { schoolId: user.schoolId },
      include: {
        category: true,
        recordedBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 200,
    })
  );

  return (
    <ExpensesContent 
      categories={categories} 
      expenses={expenses} 
    />
  );
}
