"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Clock, AlertCircle, Plus, Loader2, Pencil, Trash2, FileX } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls, selectCls, textareaCls } from "@/components/ui/form-field";
import { createFee, recordPayment, updateFeeStatus, deleteFee } from "@/lib/actions/fees";

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  WAIVED: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800",
};

const FeeSchema = z.object({
  studentId: z.string().min(1, "Student required"),
  classId: z.string().min(1, "Class required"),
  feeType: z.string().min(1, "Fee type required"),
  amount: z.coerce.number().positive("Must be positive"),
  dueDate: z.string().min(1, "Due date required"),
  remarks: z.string().optional(),
});

const PaymentSchema = z.object({
  amount: z.coerce.number().positive("Must be positive"),
  method: z.enum(["CASH", "ONLINE", "CHEQUE", "UPI"]),
  remarks: z.string().optional(),
});

type FeeFormData = z.infer<typeof FeeSchema>;
type PaymentFormData = z.infer<typeof PaymentSchema>;

interface Props {
  fees: any[];
  summary: any[];
  students: { id: string; name: string; classId: string; rollNumber: string }[];
  classes: { id: string; name: string }[];
  canEdit: boolean;
}

export function FeesContent({ fees, summary, students, classes, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [feeDialog, setFeeDialog] = useState(false);
  const [payDialog, setPayDialog] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const feeForm = useForm<FeeFormData>({ resolver: zodResolver(FeeSchema) });
  const payForm = useForm<PaymentFormData>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: { method: "CASH" },
  });

  const watchClassId = feeForm.watch("classId");
  const classStudents = watchClassId ? students.filter((s) => s.classId === watchClassId) : students;

  const getSummaryAmt = (status: string) =>
    Number(summary.find((s: any) => s.status === status)?._sum?.amount ?? 0);
  const getSummaryCount = (status: string) =>
    summary.find((s: any) => s.status === status)?._count?.id ?? 0;

  const filtered = filter ? fees.filter((f) => f.status === filter) : fees;

  const onSubmitFee = async (data: FeeFormData) => {
    const result = await createFee(data);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Fee record created");
    setFeeDialog(false);
    feeForm.reset();
    router.refresh();
  };

  const onSubmitPayment = async (data: PaymentFormData) => {
    const result = await recordPayment({ feeId: payDialog.id, ...data });
    if (result.error) { toast.error(result.error); return; }
    toast.success(`Payment recorded · Receipt: ${result.receiptNo}`);
    setPayDialog(null);
    payForm.reset();
    router.refresh();
  };

  const handleMarkOverdue = async (feeId: string) => {
    const result = await updateFeeStatus(feeId, "OVERDUE");
    if (result.error) toast.error(result.error);
    else { toast.success("Marked as overdue"); router.refresh(); }
  };

  const handleDelete = async () => {
    const result = await deleteFee(deleteTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Fee record deleted"); router.refresh(); }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fees Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track collections and pending dues</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { feeForm.reset(); setFeeDialog(true); }}
            className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Fee
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Collected", status: "PAID", icon: TrendingUp, color: "bg-green-100 text-green-600 dark:bg-green-900/30" },
          { label: "Pending", status: "PENDING", icon: Clock, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30" },
          { label: "Overdue", status: "OVERDUE", icon: AlertCircle, color: "bg-red-100 text-red-600 dark:bg-red-900/30" },
          { label: "Waived", status: "WAIVED", icon: DollarSign, color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30" },
        ].map((card) => (
          <motion.div
            key={card.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border bg-card p-5 cursor-pointer hover:shadow-md transition-shadow ${filter === card.status ? "ring-2 ring-violet-500" : ""}`}
            onClick={() => setFilter(filter === card.status ? "" : card.status)}
          >
            <div className={`p-2 rounded-lg w-fit mb-3 ${card.color}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{formatCurrency(getSummaryAmt(card.status))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label} · {getSummaryCount(card.status)} records</p>
          </motion.div>
        ))}
      </div>

      {/* Fee table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-sm font-semibold">Fee Ledger</h3>
          <div className="flex gap-1">
            {["", "PENDING", "OVERDUE", "PAID", "WAIVED"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${filter === s ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted"}`}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Fee Type</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Amount</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Due Date</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              {canEdit && <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="h-12 px-5 text-xs font-medium">{f.student?.name}</td>
                <td className="h-12 px-4 text-xs text-muted-foreground">{f.class?.name}</td>
                <td className="h-12 px-4 text-xs">{f.feeType}</td>
                <td className="h-12 px-4 text-xs font-semibold">{formatCurrency(Number(f.amount))}</td>
                <td className="h-12 px-4 text-xs text-muted-foreground">
                  {new Date(f.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="h-12 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_BADGE[f.status]}`}>
                    {f.status}
                  </span>
                </td>
                {canEdit && (
                  <td className="h-12 px-4">
                    <div className="flex items-center gap-2">
                      {f.status !== "PAID" && f.status !== "WAIVED" && (
                        <button
                          type="button"
                          onClick={() => { payForm.reset({ method: "CASH", amount: Number(f.amount) }); setPayDialog(f); }}
                          className="text-xs text-violet-600 hover:underline font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {f.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleMarkOverdue(f.id)}
                          className="text-xs text-amber-600 hover:underline"
                        >
                          Overdue
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Delete fee"
                        onClick={() => setDeleteTarget(f)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6}>
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <FileX className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-sm font-semibold mb-1">
                      {filter ? `No ${filter.toLowerCase()} fee records` : "No fee records yet"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      {filter
                        ? "Try selecting a different status filter."
                        : "Create your first fee record to start tracking collections."}
                    </p>
                    {filter ? (
                      <button
                        type="button"
                        onClick={() => setFilter("")}
                        className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors"
                      >
                        Show all records
                      </button>
                    ) : canEdit && (
                      <button
                        type="button"
                        onClick={() => { feeForm.reset(); setFeeDialog(true); }}
                        className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create Fee
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Fee Dialog */}
      <Dialog open={feeDialog} onOpenChange={setFeeDialog} title="Create Fee Record" className="max-w-lg">
        <form onSubmit={feeForm.handleSubmit(onSubmitFee)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Class" error={feeForm.formState.errors.classId?.message} required>
              <select {...feeForm.register("classId")} className={selectCls}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Student" error={feeForm.formState.errors.studentId?.message} required>
              <select {...feeForm.register("studentId")} className={selectCls} disabled={!watchClassId}>
                <option value="">Select student</option>
                {classStudents.map((s) => <option key={s.id} value={s.id}>{s.name} (#{s.rollNumber})</option>)}
              </select>
            </FormField>
            <FormField label="Fee Type" error={feeForm.formState.errors.feeType?.message} required>
              <select {...feeForm.register("feeType")} className={selectCls}>
                <option value="">Select type</option>
                {["Tuition Fee", "Transport Fee", "Lab Fee", "Sports Fee", "Library Fee", "Exam Fee", "Other"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Amount (₹)" error={feeForm.formState.errors.amount?.message} required>
              <input {...feeForm.register("amount")} type="number" min={0} step={0.01} className={inputCls} placeholder="0.00" />
            </FormField>
            <FormField label="Due Date" error={feeForm.formState.errors.dueDate?.message} required className="col-span-2">
              <input {...feeForm.register("dueDate")} type="date" className={inputCls} />
            </FormField>
            <FormField label="Remarks" className="col-span-2">
              <textarea {...feeForm.register("remarks")} rows={2} className={textareaCls} placeholder="Optional notes..." />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setFeeDialog(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={feeForm.formState.isSubmitting} className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {feeForm.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Fee
            </button>
          </div>
        </form>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(open) => { if (!open) setPayDialog(null); }} title="Record Payment" description={payDialog ? `Paying for: ${payDialog.student?.name} · ${payDialog.feeType}` : ""} className="max-w-sm">
        <form onSubmit={payForm.handleSubmit(onSubmitPayment)} className="space-y-4">
          <FormField label="Amount Paid (₹)" error={payForm.formState.errors.amount?.message} required>
            <input {...payForm.register("amount")} type="number" min={0} step={0.01} className={inputCls} />
          </FormField>
          <FormField label="Payment Method" error={payForm.formState.errors.method?.message} required>
            <select {...payForm.register("method")} className={selectCls}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="ONLINE">Online Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </FormField>
          <FormField label="Remarks">
            <textarea {...payForm.register("remarks")} rows={2} className={textareaCls} placeholder="Optional..." />
          </FormField>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setPayDialog(null)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={payForm.formState.isSubmitting} className="h-9 px-5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {payForm.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Payment
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Fee Record"
        description={`Delete this fee record for ${deleteTarget?.student?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
