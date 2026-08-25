"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, Settings, Search, Trash2 } from "lucide-react";
import { Table, Button, Input, Select, Card, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import { deleteExpense } from "@/lib/actions/expenses";

import { AddExpenseModal } from "./add-expense-modal";
import { ManageCategoriesModal } from "./manage-categories-modal";

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

interface Expense {
  id: string;
  amount: any; // Prisma returns Decimal, which may not match string | number
  date: string | Date;
  title: string;
  description: string | null;
  paymentMethod: string;
  referenceNo: string | null;
  category: ExpenseCategory;
  recordedBy: { name: string } | null;
}

interface ExpensesContentProps {
  categories: ExpenseCategory[];
  expenses: Expense[];
}

export function ExpensesContent({ categories, expenses }: Readonly<ExpensesContentProps>) {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) || 
                          e.category.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || e.category.id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setDeletingId(id);
    const toastId = `delete-exp-${id}`;
    toast.loading("Deleting expense...", { id: toastId });
    try {
      const res = await deleteExpense(id);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Expense deleted successfully", { id: toastId });
      }
    } catch {
      toast.error("Failed to delete expense", { id: toastId });
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnsType<Expense> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => format(new Date(date), "MMM d, yyyy"),
      sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      defaultSortOrder: "descend",
    },
    {
      title: "Category",
      dataIndex: ["category", "name"],
      key: "category",
      render: (name) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: "Title & Description",
      key: "title",
      render: (_, record) => (
        <div>
          <p className="font-medium">{record.title}</p>
          {record.description && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{record.description}</p>
          )}
        </div>
      ),
    },
    {
      title: "Payment",
      key: "payment",
      render: (_, record) => (
        <div>
          <p className="text-sm">{record.paymentMethod}</p>
          {record.referenceNo && (
            <p className="text-xs text-muted-foreground">{record.referenceNo}</p>
          )}
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (amount) => (
        <span className="font-medium tabular-nums">
          ₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, record) => (
        <Button 
          type="text" 
          danger 
          loading={deletingId === record.id}
          disabled={deletingId === record.id}
          icon={<Trash2 className="h-4 w-4" />} 
          onClick={() => handleDelete(record.id)} 
        />
      ),
    },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
        <div className="flex items-center space-x-2">
          <Button icon={<Settings className="w-4 h-4" />} onClick={() => setIsManageCategoriesOpen(true)}>
            Categories
          </Button>
          <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsAddExpenseOpen(true)} className="bg-violet-600">
            Add Expense
          </Button>
        </div>
      </div>

      <Card title="Expense Records" className="mt-4">
        <div>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              placeholder="Search expenses..."
              className="max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select 
              value={categoryFilter} 
              onChange={setCategoryFilter}
              style={{ width: 200 }}
              options={[
                { label: "All Categories", value: "all" },
                ...categories.map(cat => ({ label: cat.name, value: cat.id }))
              ]}
            />
          </div>

          <div className="rounded-md border">
            <Table
              dataSource={filteredExpenses}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              className="ant-table-striped"
            />
          </div>
        </div>
      </Card>

      <AddExpenseModal 
        open={isAddExpenseOpen} 
        onOpenChange={setIsAddExpenseOpen} 
        categories={categories}
      />
      <ManageCategoriesModal 
        open={isManageCategoriesOpen} 
        onOpenChange={setIsManageCategoriesOpen} 
        categories={categories}
      />
    </div>
  );
}
