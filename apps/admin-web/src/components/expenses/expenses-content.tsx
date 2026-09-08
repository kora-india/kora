"use client";

import { useState, useMemo } from "react";
import {
  format,
  isToday,
  isThisWeek,
  isThisMonth,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {
  Plus,
  Settings,
  Search,
  Trash2,
  Filter,
  RotateCcw,
  IndianRupee,
  Receipt,
  Calendar,
  CreditCard,
  Tag as TagIcon,
  ArrowUpDown,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  DatePicker,
  ConfigProvider,
  theme as antTheme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { deleteExpense } from "@/lib/actions/expenses";
import { formatCurrency } from "@schoolos/utils";
import { useQueryState } from "@/hooks/use-query-state";
import dayjs, { type Dayjs } from "dayjs";

import { AddExpenseModal } from "./add-expense-modal";
import { ManageCategoriesModal } from "./manage-categories-modal";

const { RangePicker } = DatePicker;

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

interface Expense {
  id: string;
  amount: any;
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

const PAYMENT_METHOD_TAGS: Record<string, { color: string; label: string }> = {
  CASH: { color: "gold", label: "CASH" },
  UPI: { color: "green", label: "UPI" },
  ONLINE: { color: "blue", label: "ONLINE" },
  BANK_TRANSFER: { color: "cyan", label: "BANK TRANSFER" },
  CHEQUE: { color: "purple", label: "CHEQUE" },
  CREDIT_CARD: { color: "magenta", label: "CARD" },
  DEBIT_CARD: { color: "geekblue", label: "DEBIT CARD" },
  OTHER: { color: "default", label: "OTHER" },
};

const CATEGORY_COLORS = [
  "blue",
  "purple",
  "cyan",
  "geekblue",
  "volcano",
  "orange",
  "magenta",
  "green",
];

export function ExpensesContent({
  categories,
  expenses,
}: Readonly<ExpensesContentProps>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useQueryState("q", "");
  const [categoryFilter, setCategoryFilter] = useQueryState("category", "all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useQueryState(
    "method",
    "all",
  );
  const [datePreset, setDatePreset] = useQueryState("datePreset", "all");
  const [customDateRange, setCustomDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [amountRangeFilter, setAmountRangeFilter] = useQueryState(
    "amountRange",
    "all",
  );
  const [sortBy, setSortBy] = useQueryState("sortBy", "date_desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset Filters
  const hasActiveFilters =
    search !== "" ||
    categoryFilter !== "all" ||
    paymentMethodFilter !== "all" ||
    datePreset !== "all" ||
    customDateRange !== null ||
    amountRangeFilter !== "all" ||
    sortBy !== "date_desc";

  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setPaymentMethodFilter("all");
    setDatePreset("all");
    setCustomDateRange(null);
    setAmountRangeFilter("all");
    setSortBy("date_desc");
    setCurrentPage(1);
  };

  // Distinct payment methods from existing data + defaults
  const availablePaymentMethods = useMemo(() => {
    const fromData = Array.from(
      new Set(expenses.map((e) => e.paymentMethod).filter(Boolean)),
    );
    const defaults = ["CASH", "UPI", "ONLINE", "BANK_TRANSFER", "CHEQUE"];
    return Array.from(new Set([...defaults, ...fromData]));
  }, [expenses]);

  // Filtered and Sorted Expenses
  const processedExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        // 1. Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchesTitle = e.title.toLowerCase().includes(q);
          const matchesDesc = e.description?.toLowerCase().includes(q) || false;
          const matchesCat = e.category.name.toLowerCase().includes(q);
          const matchesMethod =
            e.paymentMethod?.toLowerCase().includes(q) || false;
          const matchesRef = e.referenceNo?.toLowerCase().includes(q) || false;
          const matchesRecorded =
            e.recordedBy?.name?.toLowerCase().includes(q) || false;
          if (
            !matchesTitle &&
            !matchesDesc &&
            !matchesCat &&
            !matchesMethod &&
            !matchesRef &&
            !matchesRecorded
          ) {
            return false;
          }
        }

        // 2. Category filter
        if (categoryFilter !== "all" && e.category.id !== categoryFilter) {
          return false;
        }

        // 3. Payment method filter
        if (
          paymentMethodFilter !== "all" &&
          e.paymentMethod !== paymentMethodFilter
        ) {
          return false;
        }

        // 4. Date Range filter
        const expDate = new Date(e.date);
        if (datePreset === "today") {
          if (!isToday(expDate)) return false;
        } else if (datePreset === "week") {
          if (!isThisWeek(expDate, { weekStartsOn: 1 })) return false;
        } else if (datePreset === "month") {
          if (!isThisMonth(expDate)) return false;
        } else if (datePreset === "last_month") {
          const lastMonth = subMonths(new Date(), 1);
          const start = startOfMonth(lastMonth);
          const end = endOfMonth(lastMonth);
          if (expDate < start || expDate > end) return false;
        } else if (
          datePreset === "custom" &&
          customDateRange?.[0] &&
          customDateRange?.[1]
        ) {
          const start = customDateRange[0].startOf("day").toDate();
          const end = customDateRange[1].endOf("day").toDate();
          if (expDate < start || expDate > end) return false;
        }

        // 5. Amount Range filter
        const amt = Number(e.amount || 0);
        if (amountRangeFilter === "under_1k" && amt >= 1000) return false;
        if (amountRangeFilter === "1k_5k" && (amt < 1000 || amt > 5000))
          return false;
        if (amountRangeFilter === "5k_20k" && (amt < 5000 || amt > 20000))
          return false;
        if (amountRangeFilter === "above_20k" && amt <= 20000) return false;

        return true;
      })
      .sort((a, b) => {
        const amtA = Number(a.amount || 0);
        const amtB = Number(b.amount || 0);
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        switch (sortBy) {
          case "date_asc":
            return dateA - dateB;
          case "amount_desc":
            return amtB - amtA;
          case "amount_asc":
            return amtA - amtB;
          case "title_asc":
            return a.title.localeCompare(b.title);
          case "title_desc":
            return b.title.localeCompare(a.title);
          case "category_asc":
            return a.category.name.localeCompare(b.category.name);
          case "date_desc":
          default:
            return dateB - dateA;
        }
      });
  }, [
    expenses,
    search,
    categoryFilter,
    paymentMethodFilter,
    datePreset,
    customDateRange,
    amountRangeFilter,
    sortBy,
  ]);

  // Paginated records
  const totalPages = Math.max(
    1,
    Math.ceil(processedExpenses.length / pageSize),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedExpenses = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return processedExpenses.slice(start, start + pageSize);
  }, [processedExpenses, safeCurrentPage, pageSize]);

  // Aggregate Metrics for Current Filter
  const totalAmount = useMemo(() => {
    return processedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [processedExpenses]);

  const avgAmount = useMemo(() => {
    return processedExpenses.length > 0
      ? totalAmount / processedExpenses.length
      : 0;
  }, [processedExpenses, totalAmount]);

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

  // Export to CSV
  const handleExportCSV = () => {
    if (processedExpenses.length === 0) {
      toast.error("No expense records to export");
      return;
    }

    const headers = [
      "Date",
      "Category",
      "Title",
      "Description",
      "Payment Method",
      "Reference No",
      "Amount (INR)",
      "Recorded By",
    ];
    const rows = processedExpenses.map((e) => [
      format(new Date(e.date), "yyyy-MM-dd"),
      `"${e.category.name.replace(/"/g, '""')}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${(e.description || "").replace(/"/g, '""')}"`,
      e.paymentMethod,
      `"${(e.referenceNo || "").replace(/"/g, '""')}"`,
      Number(e.amount || 0).toFixed(2),
      `"${(e.recordedBy?.name || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `expenses_report_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expenses exported to CSV");
  };

  const columns: ColumnsType<Expense> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (date) => (
        <span className="font-medium text-xs sm:text-sm text-foreground">
          {format(new Date(date), "MMM d, yyyy")}
        </span>
      ),
      sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    },
    {
      title: "Category",
      dataIndex: ["category", "name"],
      key: "category",
      width: 150,
      render: (name, record) => {
        const catIdx = categories.findIndex((c) => c.id === record.category.id);
        const color =
          CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length] || "blue";
        return (
          <Tag
            color={color}
            className="font-semibold text-xs rounded-full px-2.5 py-0.5"
          >
            {name}
          </Tag>
        );
      },
      sorter: (a, b) => a.category.name.localeCompare(b.category.name),
    },
    {
      title: "Title & Description",
      key: "title",
      render: (_, record) => (
        <div className="min-w-[180px]">
          <p className="font-semibold text-sm text-foreground leading-snug">
            {record.title}
          </p>
          {record.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {record.description}
            </p>
          )}
          {record.recordedBy?.name && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              By:{" "}
              <span className="font-medium text-foreground/80">
                {record.recordedBy.name}
              </span>
            </p>
          )}
        </div>
      ),
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: "Payment Mode",
      key: "payment",
      width: 160,
      render: (_, record) => {
        const tagInfo = PAYMENT_METHOD_TAGS[record.paymentMethod] || {
          color: "default",
          label: record.paymentMethod || "OTHER",
        };
        return (
          <div className="space-y-0.5">
            <Tag color={tagInfo.color} className="text-[11px] font-bold">
              {tagInfo.label}
            </Tag>
            {record.referenceNo && (
              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[130px]">
                Ref: {record.referenceNo}
              </p>
            )}
          </div>
        );
      },
      sorter: (a, b) =>
        (a.paymentMethod || "").localeCompare(b.paymentMethod || ""),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      width: 140,
      render: (amount) => (
        <span className="font-bold tabular-nums text-sm text-foreground">
          {formatCurrency(Number(amount))}
        </span>
      ),
      sorter: (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          loading={deletingId === record.id}
          disabled={deletingId === record.id}
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => handleDelete(record.id)}
          title="Delete Expense"
        />
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          borderRadius: 8,
          colorBgContainer: isDark ? "#09090b" : "#ffffff",
          colorBgElevated: isDark ? "#18181b" : "#ffffff",
          colorBorder: isDark ? "#27272a" : "#e4e4e7",
          colorBorderSecondary: isDark ? "#27272a" : "#f4f4f5",
          colorText: isDark ? "#f4f4f5" : "#09090b",
          colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
        },
      }}
    >
      <div className="flex-1 space-y-5 p-4 md:p-8 pt-6 max-w-[1400px]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track operational costs, recurring utility bills, and vendor
              payments
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
              className="border-border text-xs font-medium"
            >
              Export CSV
            </Button>
            <Button
              icon={<Settings className="w-4 h-4" />}
              onClick={() => setIsManageCategoriesOpen(true)}
              className="text-xs font-medium border-border"
            >
              Categories ({categories.length})
            </Button>
            <Button
              type="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddExpenseOpen(true)}
              className="bg-violet-600 hover:bg-violet-700 font-semibold text-xs shadow-sm"
            >
              Add Expense
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Expenses
              </p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {formatCurrency(totalAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {processedExpenses.length} of {expenses.length} records shown
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Average Expense
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {formatCurrency(avgAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Per recorded transaction
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Categories Active
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {categories.length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Configured budget heads
              </p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
              <TagIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters and Sorting Toolbar in native Tailwind Card */}
        <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-5 space-y-4">
          <div className="space-y-4">
            {/* Row 1: Search & Core Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {/* Search Bar */}
              <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Search
                </label>
                <Input
                  prefix={
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  placeholder="Search title, category, ref no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="w-full"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Category
                </label>
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  className="w-full"
                  options={[
                    {
                      label: `All Categories (${expenses.length})`,
                      value: "all",
                    },
                    ...categories.map((cat) => ({
                      label: `${cat.name} (${expenses.filter((e) => e.category.id === cat.id).length})`,
                      value: cat.id,
                    })),
                  ]}
                />
              </div>

              {/* Payment Method Filter */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Payment Mode
                </label>
                <Select
                  value={paymentMethodFilter}
                  onChange={setPaymentMethodFilter}
                  className="w-full"
                  options={[
                    { label: "All Payment Modes", value: "all" },
                    ...availablePaymentMethods.map((pm) => ({
                      label: PAYMENT_METHOD_TAGS[pm]?.label || pm,
                      value: pm,
                    })),
                  ]}
                />
              </div>

              {/* Sort By Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Sort By
                </label>
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  className="w-full"
                  options={[
                    { label: "Date: Newest First", value: "date_desc" },
                    { label: "Date: Oldest First", value: "date_asc" },
                    { label: "Amount: High to Low", value: "amount_desc" },
                    { label: "Amount: Low to High", value: "amount_asc" },
                    { label: "Title: A to Z", value: "title_asc" },
                    { label: "Title: Z to A", value: "title_desc" },
                    { label: "Category: A to Z", value: "category_asc" },
                  ]}
                />
              </div>
            </div>

            {/* Row 2: Date Presets & Amount Ranges */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date:
                </span>
                {[
                  { key: "all", label: "All Time" },
                  { key: "today", label: "Today" },
                  { key: "week", label: "This Week" },
                  { key: "month", label: "This Month" },
                  { key: "last_month", label: "Last Month" },
                  { key: "custom", label: "Custom Range" },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDatePreset(p.key)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      datePreset === p.key
                        ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                        : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}

                {datePreset === "custom" && (
                  <RangePicker
                    value={customDateRange}
                    onChange={(dates) => setCustomDateRange(dates as any)}
                    className="h-8 text-xs ml-1"
                    format="DD MMM YYYY"
                  />
                )}
              </div>

              {/* Amount Filter Pills & Reset Button */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5" /> Amount:
                </span>
                {[
                  { key: "all", label: "All" },
                  { key: "under_1k", label: "< ₹1k" },
                  { key: "1k_5k", label: "₹1k - ₹5k" },
                  { key: "5k_20k", label: "₹5k - ₹20k" },
                  { key: "above_20k", label: "> ₹20k" },
                ].map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAmountRangeFilter(a.key)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      amountRangeFilter === a.key
                        ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                        : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}

                {hasActiveFilters && (
                  <Button
                    size="small"
                    onClick={handleResetFilters}
                    icon={<RotateCcw className="w-3 h-3" />}
                    className="text-xs ml-2 text-muted-foreground hover:text-foreground border-border"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden mt-5 bg-card">
            <Table
              dataSource={paginatedExpenses}
              columns={columns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 800 }}
              className="ant-table-striped"
            />

            {/* Custom Clean Pagination Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing{" "}
                  <strong className="text-foreground font-semibold">
                    {processedExpenses.length === 0
                      ? 0
                      : (safeCurrentPage - 1) * pageSize + 1}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-foreground font-semibold">
                    {Math.min(
                      safeCurrentPage * pageSize,
                      processedExpenses.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-foreground font-semibold">
                    {processedExpenses.length}
                  </strong>{" "}
                  expenses
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Page Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous Page"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      return Math.abs(p - safeCurrentPage) <= 1;
                    })
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;
                      return (
                        <div key={p} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-1 text-muted-foreground">
                              …
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                              p === safeCurrentPage
                                ? "bg-violet-600 text-white shadow-xs"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {p}
                          </button>
                        </div>
                      );
                    })}

                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    aria-label="Next Page"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

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
    </ConfigProvider>
  );
}
