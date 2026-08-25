"use client";

import React, { useState } from "react";
import { formatCurrency } from "@schoolos/utils";
import { allocatePayment, waiveFeeChargeItem } from "@/lib/actions/fee-allocator";
import { toast } from "sonner";
import {
  Wallet,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Receipt,
  CreditCard,
  Eye,
  ArrowUpRight,
} from "lucide-react";
import { Select } from "antd";

interface StudentFeeCollectionProps {
  student: any;
  canEdit: boolean;
  onPaymentSuccess: (receiptNo: string) => void;
  onWaiveSuccess?: () => void;
}

export function StudentFeeCollection({
  student,
  canEdit,
  onPaymentSuccess,
  onWaiveSuccess,
}: Readonly<StudentFeeCollectionProps>) {
  const [selectedComponents, setSelectedComponents] = useState<Record<string, boolean>>({});
  const [componentPayments, setComponentPayments] = useState<Record<string, string>>({});
  const [generalAdvance, setGeneralAdvance] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waivingItemId, setWaivingItemId] = useState<string | null>(null);

  // Filter charges for this student
  const studentCharges = (student?.feeCharges || []).filter(
    (c: any) => c.status !== "WAIVED"
  );

  const advanceBalance =
    student?.advanceLedgers?.reduce(
      (sum: number, l: any) => sum + Number(l.amount || 0),
      0
    ) || 0;

  // Group by component
  const componentSummary: Record<string, any> = {};
  let totalOutstanding = 0;

  for (const charge of studentCharges) {
    for (const item of charge.items || []) {
      const compId = item.componentId || item.id;
      const compName = item.component?.name || "Fee";
      const due =
        item.status === "WAIVED"
          ? 0
          : Number(item.amount || 0) - Number(item.paidAmount || 0);
      const isLateFee =
        item.component?.category === "LATE_FEE" ||
        compName.toLowerCase().includes("late");

      if (!componentSummary[compId]) {
        componentSummary[compId] = {
          id: compId,
          name: compName,
          totalDue: 0,
          items: [],
        };
      }

      componentSummary[compId].items.push({
        id: item.id,
        chargeTitle: charge.title,
        dueDate: charge.dueDate,
        amount: Number(item.amount),
        paidAmount: Number(item.paidAmount),
        due: due,
        status:
          item.status === "WAIVED"
            ? "WAIVED"
            : due <= 0
            ? "PAID"
            : Number(item.paidAmount) > 0
            ? "PARTIAL"
            : "PENDING",
        isLateFee,
      });

      if (due > 0) {
        componentSummary[compId].totalDue += due;
        totalOutstanding += due;
      }
    }
  }

  const componentList = Object.values(componentSummary).filter(
    (c) => c.totalDue > 0
  );

  const toggleComponent = (id: string, totalDue: number) => {
    const isSelected = !selectedComponents[id];
    setSelectedComponents((prev) => ({ ...prev, [id]: isSelected }));

    if (isSelected) {
      setComponentPayments((prev) => ({ ...prev, [id]: totalDue.toString() }));
    } else {
      setComponentPayments((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const selectAllComponents = () => {
    const allSelected =
      componentList.length > 0 &&
      componentList.every((c) => selectedComponents[c.id]);

    if (allSelected) {
      setSelectedComponents({});
      setComponentPayments({});
    } else {
      const newSelected: Record<string, boolean> = {};
      const newPayments: Record<string, string> = {};
      componentList.forEach((c) => {
        newSelected[c.id] = true;
        newPayments[c.id] = c.totalDue.toString();
      });
      setSelectedComponents(newSelected);
      setComponentPayments(newPayments);
    }
  };

  const updateComponentPayment = (id: string, amount: string) => {
    setComponentPayments((prev) => ({ ...prev, [id]: amount }));
    if (Number(amount) > 0 && !selectedComponents[id]) {
      setSelectedComponents((prev) => ({ ...prev, [id]: true }));
    } else if (Number(amount) <= 0 && selectedComponents[id]) {
      setSelectedComponents((prev) => ({ ...prev, [id]: false }));
    }
  };

  const totalPayment =
    Object.values(componentPayments).reduce(
      (sum, val) => sum + (Number(val) || 0),
      0
    ) + (Number(generalAdvance) || 0);

  const generatePreview = () => {
    const preview: any[] = [];

    for (const [compId, amountStr] of Object.entries(componentPayments)) {
      if (!selectedComponents[compId]) continue;

      let remaining = Number(amountStr);
      if (remaining <= 0) continue;

      const compData = componentSummary[compId];
      if (!compData) continue;

      const allocations = [];
      const sortedItems = [...compData.items].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      for (const item of sortedItems) {
        if (remaining <= 0) break;

        const allocAmount = Math.min(item.due, remaining);
        let newStatus = "Partial";
        if (item.paidAmount + allocAmount >= item.amount) {
          newStatus = "Paid";
        }

        allocations.push({
          title: item.chargeTitle,
          allocated: allocAmount,
          newStatus,
        });

        remaining -= allocAmount;
      }

      preview.push({
        componentName: compData.name,
        allocations,
        advance: remaining > 0 ? remaining : 0,
      });
    }

    return preview;
  };

  const handleWaiveItem = async (itemId: string) => {
    setWaivingItemId(itemId);
    const toastId = `waive-${itemId}`;
    toast.loading("Waiving late fee...", { id: toastId });

    try {
      const res = await waiveFeeChargeItem(itemId);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Late fee waived successfully", { id: toastId });
        onWaiveSuccess?.();
      }
    } catch {
      toast.error("Failed to waive late fee", { id: toastId });
    } finally {
      setWaivingItemId(null);
    }
  };

  const handlePayment = async () => {
    if (totalPayment <= 0) {
      toast.error("Please enter payment amounts to collect.");
      return;
    }

    setIsSubmitting(true);
    const toastId = "payment-process";
    toast.loading("Processing payment transaction...", { id: toastId });

    try {
      const payloadPayments = Object.entries(componentPayments)
        .filter(([id, val]) => selectedComponents[id] && Number(val) > 0)
        .map(([id, val]) => ({ componentId: id, amount: Number(val) }));

      const res = await allocatePayment({
        studentId: student.id,
        componentPayments: payloadPayments,
        generalAdvanceAmount: Number(generalAdvance) || 0,
        method: paymentMethod as any,
        reference: reference || undefined,
        remarks: remarks || undefined,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        const receipt = (res as any).receiptNo || "Receipt Created";
        toast.success(`Payment successful! Receipt: ${receipt}`, { id: toastId });
        setComponentPayments({});
        setSelectedComponents({});
        setGeneralAdvance("");
        setReference("");
        setRemarks("");
        setShowPreview(false);
        onPaymentSuccess(receipt);
      }
    } catch {
      toast.error("Payment processing failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Top Banner: Outstanding Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-violet-800 dark:text-violet-300 uppercase tracking-wide">
              Total Outstanding Due
            </span>
            <p className="text-2xl font-black text-violet-950 dark:text-violet-100 mt-1">
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
          {componentList.length > 0 && canEdit && (
            <button
              type="button"
              onClick={selectAllComponents}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
            >
              {componentList.every((c) => selectedComponents[c.id])
                ? "Clear All"
                : "Pay Full Dues"}
            </button>
          )}
        </div>

        {advanceBalance > 0 ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Advance Available
              </span>
              <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
                {formatCurrency(advanceBalance)}
              </p>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded-md font-medium">
              Credit Active
            </span>
          </div>
        ) : (
          <div className="p-4 bg-muted/30 border rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-medium">
                Advance Balance
              </span>
              <p className="text-xl font-bold text-muted-foreground mt-1">₹0.00</p>
            </div>
          </div>
        )}
      </div>

      {/* Component Due Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="p-3.5 border-b bg-muted/20 flex justify-between items-center">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-violet-600" /> Outstanding Fee Components
          </h3>
          <span className="text-xs text-muted-foreground font-medium">
            {componentList.length} component{componentList.length === 1 ? "" : "s"} with dues
          </span>
        </div>

        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground border-b sticky top-0 bg-background z-10">
              <tr>
                <th className="py-2.5 px-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={
                      componentList.length > 0 &&
                      componentList.every((c) => selectedComponents[c.id])
                    }
                    onChange={selectAllComponents}
                    disabled={componentList.length === 0 || !canEdit}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                </th>
                <th className="py-2.5 px-3 text-left font-medium">Component</th>
                <th className="py-2.5 px-3 text-right font-medium">Total Due</th>
                <th className="py-2.5 px-3 text-right font-medium w-36">Pay Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {componentList.map((c) => {
                const isSelected = !!selectedComponents[c.id];
                const isExpanded = !!expandedComponents[c.id];

                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-violet-50/40 dark:bg-violet-950/10" : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleComponent(c.id, c.totalDue)}
                          disabled={!canEdit}
                          className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                      </td>
                      <td className="py-3 px-3 font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedComponents((prev) => ({
                                ...prev,
                                [c.id]: !prev[c.id],
                              }))
                            }
                            className="p-1 rounded hover:bg-muted/60 text-muted-foreground"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span>{c.name}</span>
                          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                            {c.items.length} charge{c.items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {formatCurrency(c.totalDue)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          placeholder="0"
                          value={componentPayments[c.id] || ""}
                          onChange={(e) => updateComponentPayment(c.id, e.target.value)}
                          disabled={!canEdit}
                          className="w-28 h-8 px-2 text-right text-xs font-semibold rounded-lg border bg-background focus:ring-2 focus:ring-violet-500 focus:outline-none"
                        />
                      </td>
                    </tr>

                    {/* Expanded Items Breakdown */}
                    {isExpanded && (
                      <tr className="bg-muted/10 border-b">
                        <td colSpan={4} className="p-3 pl-10">
                          <div className="border rounded-lg bg-background/80 p-2.5 space-y-2">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase">
                              Underlying Due Records
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-left pb-1 font-medium">Charge</th>
                                  <th className="text-left pb-1 font-medium">Due Date</th>
                                  <th className="text-right pb-1 font-medium">Amount</th>
                                  <th className="text-right pb-1 font-medium">Due</th>
                                  <th className="text-right pb-1 font-medium">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-muted/50">
                                {c.items.map((item: any) => (
                                  <tr key={item.id} className="py-1">
                                    <td className="py-1.5 font-medium">{item.chargeTitle}</td>
                                    <td className="py-1.5 text-muted-foreground">
                                      {new Date(item.dueDate).toLocaleDateString("en-IN", {
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {formatCurrency(item.amount)}
                                    </td>
                                    <td className="py-1.5 text-right font-semibold text-amber-600">
                                      {formatCurrency(item.due)}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {item.isLateFee && item.due > 0 && canEdit && (
                                        <button
                                          type="button"
                                          disabled={waivingItemId === item.id}
                                          onClick={() => handleWaiveItem(item.id)}
                                          className="text-[10px] px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                                        >
                                          {waivingItemId === item.id && (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                          )}
                                          Waive
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {componentList.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-sm">No Outstanding Dues</p>
                    <p className="text-xs text-muted-foreground">
                      This student has fully settled all current fee components.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Processing Form */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Receipt className="w-4 h-4 text-violet-600" /> Payment & Receipt Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Payment Method</label>
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              className="w-full h-9"
              options={[
                { label: "Cash", value: "CASH" },
                { label: "UPI", value: "UPI" },
                { label: "Bank Transfer", value: "BANK_TRANSFER" },
                { label: "Cheque", value: "CHEQUE" },
                { label: "Debit Card", value: "DEBIT_CARD" },
                { label: "Credit Card", value: "CREDIT_CARD" },
                { label: "NEFT", value: "NEFT" },
                { label: "RTGS", value: "RTGS" },
                { label: "IMPS", value: "IMPS" },
                { label: "Online", value: "ONLINE" },
                { label: "Other", value: "OTHER" },
              ]}
            />
          </div>

          {/* Reference / Transaction ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Reference / Cheque No.</label>
            <input
              type="text"
              placeholder="e.g. UPI-1238495 / Cheque #004"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
          </div>

          {/* General Advance / Extra Payment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Add General Advance (₹)</label>
            <input
              type="number"
              placeholder="0 (Optional credit)"
              value={generalAdvance}
              onChange={(e) => setGeneralAdvance(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Remarks */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium block">Remarks / Notes</label>
          <input
            type="text"
            placeholder="Optional receipt notes (e.g. Paid by father in cash at office)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
          />
        </div>

        {/* Allocation Preview Toggle & Breakdown */}
        {totalPayment > 0 && (
          <div className="pt-2 border-t space-y-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? "Hide Allocation Preview" : "Preview Payment Breakdown"}
            </button>

            {showPreview && (
              <div className="p-3 bg-muted/30 border rounded-lg space-y-2 text-xs">
                {generatePreview().map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-semibold text-violet-700 dark:text-violet-400">
                      {p.componentName}
                    </p>
                    <div className="pl-3 space-y-0.5">
                      {p.allocations.map((a: any, aIdx: number) => (
                        <div key={aIdx} className="flex justify-between text-muted-foreground">
                          <span>{a.title} ({a.newStatus})</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(a.allocated)}
                          </span>
                        </div>
                      ))}
                      {p.advance > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Advance Credit (Overpayment)</span>
                          <span>{formatCurrency(p.advance)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {Number(generalAdvance) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold border-t pt-1">
                    <span>Direct General Advance</span>
                    <span>{formatCurrency(Number(generalAdvance))}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit Bar */}
        <div className="pt-3 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Total Collection:</span>
            <span className="text-lg font-black text-violet-700 dark:text-violet-300">
              {formatCurrency(totalPayment)}
            </span>
          </div>

          <button
            type="button"
            disabled={totalPayment <= 0 || isSubmitting || !canEdit}
            onClick={handlePayment}
            className="h-10 px-6 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                Collect Payment ({formatCurrency(totalPayment)})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
