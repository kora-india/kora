"use client";

import React, { useState, useMemo } from "react";
import { formatCurrency } from "@schoolos/utils";
import {
  allocatePayment,
  waiveFeeChargeItem,
  type FeeReceiptData,
} from "@/lib/actions/fee-allocator";
import { FeeReceiptModal } from "@/components/fees/fee-receipt-modal";
import { toast } from "sonner";
import {
  Wallet,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Receipt,
  Calendar,
  Eye,
  ArrowUpRight,
  Bus,
  Sparkles,
  Printer,
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
  const [selectedMonths, setSelectedMonths] = useState<Record<string, boolean>>(
    {},
  );
  const [monthPayments, setMonthPayments] = useState<Record<string, string>>(
    {},
  );
  const [itemPayments, setItemPayments] = useState<Record<string, string>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(
    {},
  );
  const [generalAdvance, setGeneralAdvance] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waivingItemId, setWaivingItemId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<FeeReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);

  // Filter non-waived charges for this student sorted by due date
  const studentCharges = useMemo(() => {
    return (student?.feeCharges || [])
      .filter((c: any) => c.status !== "WAIVED")
      .sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
  }, [student?.feeCharges]);

  const advanceBalance =
    student?.advanceLedgers?.reduce(
      (sum: number, l: any) => sum + Number(l.amount || 0),
      0,
    ) || 0;

  // Process month-wise charge records with their items
  const { monthList, totalOutstanding } = useMemo(() => {
    let overallOutstanding = 0;
    const list = studentCharges.map((charge: any) => {
      let monthNetCharge = 0;
      let monthPaid = 0;
      let monthTotalDue = 0;

      const items = (charge.items || []).map((item: any) => {
        const amt = Number(item.amount || 0);
        const paid = Number(item.paidAmount || 0);
        const due = item.status === "WAIVED" ? 0 : Math.max(0, amt - paid);
        const compName = item.component?.name || "Fee";
        const isLateFee =
          item.component?.category === "LATE_FEE" ||
          compName.toLowerCase().includes("late");

        monthNetCharge += amt;
        monthPaid += paid;
        monthTotalDue += due;

        return {
          id: item.id,
          componentId: item.componentId,
          componentName: compName,
          amount: amt,
          paidAmount: paid,
          due,
          status:
            item.status === "WAIVED"
              ? "WAIVED"
              : due <= 0
                ? "PAID"
                : paid > 0
                  ? "PARTIAL"
                  : "PENDING",
          isLateFee,
        };
      });

      overallOutstanding += monthTotalDue;

      return {
        id: charge.id,
        title: charge.title,
        dueDate: charge.dueDate,
        status: charge.status,
        netCharge: monthNetCharge,
        paidAmount: monthPaid,
        totalDue: monthTotalDue,
        items,
      };
    });

    const activeMonths = list.filter((m: any) => m.totalDue > 0);
    return { monthList: activeMonths, totalOutstanding: overallOutstanding };
  }, [studentCharges]);

  const feePaymentMode = student?.school?.feePaymentMode || "ALLOW_PARTIAL";
  const minPartialPaymentPercentage = Number(
    student?.school?.minPartialPaymentPercentage || 0,
  );
  const minPartialPaymentAmount = Number(
    student?.school?.minPartialPaymentAmount || 0,
  );

  // Handle Month Amount Change with Pro-Rata (Percentage) Auto-Distribution
  const updateMonthPayment = (chargeId: string, amountStr: string) => {
    const charge = monthList.find((m: any) => m.id === chargeId);
    if (!charge) return;

    setMonthPayments((prev) => ({ ...prev, [chargeId]: amountStr }));

    const enteredAmount = Number(amountStr) || 0;

    if (enteredAmount > 0) {
      if (!selectedMonths[chargeId]) {
        setSelectedMonths((prev) => ({ ...prev, [chargeId]: true }));
      }

      const updatedItemAllocations: Record<string, string> = {};
      const eligibleItems = charge.items.filter((it: any) => it.due > 0);

      if (enteredAmount >= charge.totalDue) {
        // If payment covers entire month due or more, allocate 100% to each item
        for (const item of charge.items) {
          if (item.due > 0) {
            updatedItemAllocations[item.id] = item.due.toString();
          } else {
            updatedItemAllocations[item.id] = "";
          }
        }
      } else if (charge.totalDue > 0 && eligibleItems.length > 0) {
        // Pro-Rata (Percentage / Proportional) Split
        let allocatedSum = 0;
        const isIntegerPayment =
          Number.isInteger(enteredAmount) &&
          eligibleItems.every((it: any) => Number.isInteger(it.due));

        eligibleItems.forEach((item: any, idx: number) => {
          if (idx === eligibleItems.length - 1) {
            // Last item receives remaining balance to ensure sum matches enteredAmount exactly
            const remainingBalance = enteredAmount - allocatedSum;
            const lastAlloc = Math.max(
              0,
              Math.min(item.due, Math.round(remainingBalance * 100) / 100),
            );
            updatedItemAllocations[item.id] =
              lastAlloc > 0
                ? Number.isInteger(lastAlloc)
                  ? lastAlloc.toString()
                  : lastAlloc.toFixed(2)
                : "";
          } else {
            const proportionalShare =
              (item.due / charge.totalDue) * enteredAmount;
            const roundedAlloc = isIntegerPayment
              ? Math.min(item.due, Math.round(proportionalShare))
              : Math.min(item.due, Math.round(proportionalShare * 100) / 100);

            allocatedSum += roundedAlloc;
            updatedItemAllocations[item.id] =
              roundedAlloc > 0 ? roundedAlloc.toString() : "";
          }
        });

        // Set items with 0 due to empty
        charge.items.forEach((item: any) => {
          if (item.due <= 0) {
            updatedItemAllocations[item.id] = "";
          }
        });
      }

      setItemPayments((prev) => ({ ...prev, ...updatedItemAllocations }));
    } else {
      setSelectedMonths((prev) => ({ ...prev, [chargeId]: false }));
      const clearedItems: Record<string, string> = {};
      charge.items.forEach((item: any) => {
        clearedItems[item.id] = "";
      });
      setItemPayments((prev) => ({ ...prev, ...clearedItems }));
    }
  };

  // Handle manual fine-tuning of an individual item inside the uncollapsed month
  const updateItemPayment = (
    chargeId: string,
    itemId: string,
    itemAmountStr: string,
  ) => {
    const charge = monthList.find((m: any) => m.id === chargeId);
    if (!charge) return;

    const newItemPayments = { ...itemPayments, [itemId]: itemAmountStr };
    setItemPayments(newItemPayments);

    // Sum all item payments for this month
    const totalForMonth = charge.items.reduce((sum: number, it: any) => {
      const val = Number(newItemPayments[it.id]) || 0;
      return sum + val;
    }, 0);

    setMonthPayments((prev) => ({
      ...prev,
      [chargeId]: totalForMonth > 0 ? totalForMonth.toString() : "",
    }));

    if (totalForMonth > 0) {
      setSelectedMonths((prev) => ({ ...prev, [chargeId]: true }));
    } else {
      setSelectedMonths((prev) => ({ ...prev, [chargeId]: false }));
    }
  };

  // Toggle single month checkbox
  const toggleMonth = (chargeId: string, totalDue: number) => {
    const isSelected = !selectedMonths[chargeId];
    setSelectedMonths((prev) => ({ ...prev, [chargeId]: isSelected }));

    if (isSelected) {
      updateMonthPayment(chargeId, totalDue.toString());
    } else {
      updateMonthPayment(chargeId, "");
    }
  };

  // Select / Deselect All Months
  const selectAllMonths = () => {
    const allSelected =
      monthList.length > 0 && monthList.every((m: any) => selectedMonths[m.id]);

    if (allSelected) {
      setSelectedMonths({});
      setMonthPayments({});
      setItemPayments({});
    } else {
      const newSelected: Record<string, boolean> = {};
      const newMonthPayments: Record<string, string> = {};
      const newItemPayments: Record<string, string> = {};

      monthList.forEach((m: any) => {
        newSelected[m.id] = true;
        newMonthPayments[m.id] = m.totalDue.toString();

        m.items.forEach((item: any) => {
          if (item.due > 0) {
            newItemPayments[item.id] = item.due.toString();
          }
        });
      });

      setSelectedMonths(newSelected);
      setMonthPayments(newMonthPayments);
      setItemPayments(newItemPayments);
    }
  };

  // Total calculated payment across all selected months + extra advance
  const totalPayment = useMemo(() => {
    const monthsTotal = Object.entries(monthPayments).reduce(
      (sum, [id, val]) => {
        if (selectedMonths[id]) {
          return sum + (Number(val) || 0);
        }
        return sum;
      },
      0,
    );

    return monthsTotal + (Number(generalAdvance) || 0);
  }, [monthPayments, selectedMonths, generalAdvance]);

  // Generate real-time breakdown preview for modal
  const generatePreview = () => {
    const preview: any[] = [];

    monthList.forEach((charge: any) => {
      if (!selectedMonths[charge.id]) return;

      const monthAllocations: any[] = [];
      let totalAllocatedToMonth = 0;

      charge.items.forEach((item: any) => {
        const payVal = Number(itemPayments[item.id]) || 0;
        if (payVal > 0) {
          totalAllocatedToMonth += payVal;
          let newStatus = "Partial";
          if (item.paidAmount + payVal >= item.amount) {
            newStatus = "Paid";
          }
          monthAllocations.push({
            componentName: item.componentName,
            allocated: payVal,
            newStatus,
          });
        }
      });

      const monthEntered = Number(monthPayments[charge.id]) || 0;
      const surplusAdvance = Math.max(0, monthEntered - totalAllocatedToMonth);

      if (monthAllocations.length > 0 || surplusAdvance > 0) {
        preview.push({
          monthTitle: charge.title,
          allocations: monthAllocations,
          surplusAdvance,
        });
      }
    });

    return preview;
  };

  // Waive Late Fee Action
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

  // Submit Payment Action
  const handlePayment = async (shouldPrintReceipt: boolean = false) => {
    if (totalPayment <= 0) {
      toast.error("Please enter payment amounts to collect.");
      return;
    }

    setIsSubmitting(true);
    const toastId = "payment-process";
    toast.loading("Processing payment transaction...", { id: toastId });

    try {
      // Validate policies before dispatching
      if (feePaymentMode === "FULL_ONLY") {
        for (const [mId, val] of Object.entries(monthPayments)) {
          if (!selectedMonths[mId]) continue;
          const num = Number(val) || 0;
          const targetMonth = monthList.find((m: any) => m.id === mId);
          if (targetMonth && num > 0 && num < targetMonth.totalDue) {
            toast.error(
              `School policy requires clearing ${targetMonth.title} fully (₹${targetMonth.totalDue}). Partial payments are disabled.`,
              { id: toastId },
            );
            setIsSubmitting(false);
            return;
          }
        }
      } else if (feePaymentMode === "ALLOW_PARTIAL") {
        for (const [mId, val] of Object.entries(monthPayments)) {
          if (!selectedMonths[mId]) continue;
          const num = Number(val) || 0;
          const targetMonth = monthList.find((m: any) => m.id === mId);
          if (!targetMonth || num <= 0) continue;

          const minReq =
            minPartialPaymentPercentage > 0
              ? Math.ceil(
                  (targetMonth.netCharge * minPartialPaymentPercentage) / 100,
                )
              : minPartialPaymentAmount;

          if (minReq > 0) {
            // LOOPHOLE PREVENTION: If remaining due <= minReq, must pay full remaining balance
            if (targetMonth.totalDue <= minReq && num < targetMonth.totalDue) {
              toast.error(
                `The remaining due for ${targetMonth.title} is ₹${targetMonth.totalDue}, which is at or below the minimum partial threshold (${minPartialPaymentPercentage > 0 ? `${minPartialPaymentPercentage}% (₹${minReq})` : `₹${minReq}`}). It must be cleared in full.`,
                { id: toastId },
              );
              setIsSubmitting(false);
              return;
            } else if (num < minReq && num < targetMonth.totalDue) {
              toast.error(
                `Payment for ${targetMonth.title} must be at least ${minPartialPaymentPercentage > 0 ? `${minPartialPaymentPercentage}% of total fee (₹${minReq})` : `₹${minReq}`}.`,
                { id: toastId },
              );
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      // Collect month payments directly
      const payloadMonthPayments = Object.entries(monthPayments)
        .filter(([id, val]) => selectedMonths[id] && Number(val) > 0)
        .map(([id, val]) => ({ chargeId: id, amount: Number(val) }));

      const res = await allocatePayment({
        studentId: student.id,
        monthPayments: payloadMonthPayments,
        generalAdvanceAmount:
          Number(generalAdvance) > 0 ? Number(generalAdvance) : undefined,
        method: paymentMethod as any,
        reference: reference || undefined,
        remarks: remarks || undefined,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        const receipt = (res as any).receiptNo || "Receipt Created";
        toast.success(`Payment successful! Receipt: ${receipt}`, {
          id: toastId,
        });
        setMonthPayments({});
        setItemPayments({});
        setSelectedMonths({});
        setGeneralAdvance("");
        setReference("");
        setRemarks("");
        setShowPreview(false);

        if ((res as any).receiptData) {
          setReceiptData((res as any).receiptData);
          setAutoPrint(shouldPrintReceipt);
          setShowReceiptModal(true);
        }

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
          {monthList.length > 0 && canEdit && (
            <button
              type="button"
              onClick={selectAllMonths}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
            >
              {monthList.every((m: any) => selectedMonths[m.id])
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
              <p className="text-xl font-bold text-muted-foreground mt-1">
                ₹0.00
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transport Alert if Opted-in */}
      {(() => {
        const activeTransport = student?.transports?.[0];
        if (!activeTransport) return null;
        return (
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    Transport Service Opted-In
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                    {activeTransport.tripType
                      ? activeTransport.tripType.replace("_", " ")
                      : "Active"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Route:{" "}
                  <span className="font-medium text-foreground">
                    {activeTransport.route?.name || "Assigned Route"}
                  </span>
                  {activeTransport.stop?.stopName && (
                    <span>
                      {" "}
                      • Stop:{" "}
                      <span className="font-medium text-foreground">
                        {activeTransport.stop.stopName}
                      </span>{" "}
                      (
                      {Number(
                        activeTransport.distanceKm ||
                          activeTransport.stop.distanceFromSchoolKm ||
                          0,
                      )}{" "}
                      km)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] text-muted-foreground">
                Monthly Transport Fee
              </p>
              <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(Number(activeTransport.monthlyFee || 0))}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Month-Wise Fee Dues Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="p-3.5 border-b bg-muted/20 flex justify-between items-center">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600" /> Outstanding Monthly
            Fee Dues
          </h3>
          <span className="text-xs text-muted-foreground font-medium">
            {monthList.length} month{monthList.length === 1 ? "" : "s"} with
            dues
          </span>
        </div>

        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground border-b sticky top-0 bg-background z-10">
              <tr>
                <th className="py-2.5 px-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={
                      monthList.length > 0 &&
                      monthList.every((m: any) => selectedMonths[m.id])
                    }
                    onChange={selectAllMonths}
                    disabled={monthList.length === 0 || !canEdit}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                </th>
                <th className="py-2.5 px-3 text-left font-medium">
                  Month / Charge
                </th>
                <th className="py-2.5 px-3 text-left font-medium">Due Date</th>
                <th className="py-2.5 px-3 text-right font-medium">
                  Net Charge
                </th>
                <th className="py-2.5 px-3 text-right font-medium">Paid</th>
                <th className="py-2.5 px-3 text-right font-medium">Payable</th>
                <th className="py-2.5 px-3 text-right font-medium w-40">
                  Pay Amount (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthList.map((month: any) => {
                const isSelected = !!selectedMonths[month.id];
                const isExpanded = !!expandedMonths[month.id];

                return (
                  <React.Fragment key={month.id}>
                    {/* Month Parent Row */}
                    <tr
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected
                          ? "bg-violet-50/40 dark:bg-violet-950/10"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMonth(month.id, month.totalDue)}
                          disabled={!canEdit}
                          className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                      </td>
                      <td className="py-3 px-3 font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMonths((prev) => ({
                                ...prev,
                                [month.id]: !prev[month.id],
                              }))
                            }
                            className="p-1 rounded hover:bg-muted/60 text-muted-foreground transition-colors"
                            title="Expand / Collapse underlying components"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="font-semibold text-foreground">
                            {month.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                            {month.items.length} component
                            {month.items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {new Date(month.dueDate).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatCurrency(month.netCharge)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(month.paidAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(month.totalDue)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {(() => {
                          const minRequiredForMonth =
                            minPartialPaymentPercentage > 0
                              ? Math.ceil(
                                  (month.netCharge *
                                    minPartialPaymentPercentage) /
                                    100,
                                )
                              : minPartialPaymentAmount;

                          const isRemainingBelowThreshold =
                            minRequiredForMonth > 0 &&
                            month.totalDue <= minRequiredForMonth;
                          const isFullDueOnlyForMonth =
                            feePaymentMode === "FULL_ONLY" ||
                            isRemainingBelowThreshold;

                          return (
                            <>
                              <input
                                type="number"
                                placeholder="0"
                                value={monthPayments[month.id] || ""}
                                readOnly={isFullDueOnlyForMonth}
                                onChange={(e) =>
                                  !isFullDueOnlyForMonth &&
                                  updateMonthPayment(month.id, e.target.value)
                                }
                                disabled={!canEdit}
                                className={`w-32 h-8 px-2.5 text-right text-xs font-bold rounded-lg border bg-background focus:ring-2 focus:ring-violet-500 focus:outline-none ${
                                  isFullDueOnlyForMonth
                                    ? "bg-muted/30 cursor-not-allowed text-muted-foreground"
                                    : ""
                                }`}
                              />
                              {feePaymentMode === "FULL_ONLY" && (
                                <span className="block text-[9px] text-muted-foreground mt-0.5 font-medium">
                                  Full Due Only
                                </span>
                              )}
                              {feePaymentMode === "ALLOW_PARTIAL" &&
                                isRemainingBelowThreshold && (
                                  <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                                    Must Pay Remainder (≤{" "}
                                    {minPartialPaymentPercentage > 0
                                      ? `${minPartialPaymentPercentage}%`
                                      : `₹${minRequiredForMonth}`}
                                    )
                                  </span>
                                )}
                              {feePaymentMode === "ALLOW_PARTIAL" &&
                                !isRemainingBelowThreshold &&
                                minRequiredForMonth > 0 &&
                                Number(monthPayments[month.id]) > 0 &&
                                Number(monthPayments[month.id]) <
                                  minRequiredForMonth &&
                                Number(monthPayments[month.id]) <
                                  month.totalDue && (
                                  <span className="block text-[9px] text-rose-600 font-semibold mt-0.5">
                                    Min{" "}
                                    {minPartialPaymentPercentage > 0
                                      ? `${minPartialPaymentPercentage}% (₹${minRequiredForMonth})`
                                      : `₹${minRequiredForMonth}`}
                                  </span>
                                )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>

                    {/* Uncollapsed / Expanded Underlying Components Breakdown */}
                    {isExpanded && (
                      <tr className="bg-muted/10 border-b">
                        <td colSpan={7} className="p-3 pl-8 sm:pl-12">
                          <div className="border rounded-xl bg-background/90 p-3 space-y-2 shadow-sm">
                            <div className="flex items-center justify-between pb-1 border-b">
                              <p className="text-[11px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" /> Underlying
                                Components for {month.title}
                              </p>
                              <span className="text-[10px] text-muted-foreground">
                                Entering month amount pro-rata splits across
                                components based on dues
                              </span>
                            </div>

                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b pb-1 text-left">
                                  <th className="pb-1 font-medium">
                                    Component
                                  </th>
                                  <th className="text-right pb-1 font-medium">
                                    Net Charge
                                  </th>
                                  <th className="text-right pb-1 font-medium">
                                    Paid
                                  </th>
                                  <th className="text-right pb-1 font-medium">
                                    Payable
                                  </th>
                                  <th className="text-right pb-1 font-medium w-36">
                                    Allocated Pay (₹)
                                  </th>
                                  <th className="text-right pb-1 font-medium w-16">
                                    Action
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-muted/40">
                                {month.items.map((item: any) => (
                                  <tr key={item.id} className="py-1">
                                    <td className="py-1.5 font-medium text-foreground">
                                      {item.componentName}
                                    </td>
                                    <td className="py-1.5 text-right font-medium text-slate-700 dark:text-slate-300">
                                      {formatCurrency(item.amount)}
                                    </td>
                                    <td className="py-1.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(item.paidAmount)}
                                    </td>
                                    <td
                                      className={`py-1.5 text-right font-semibold ${item.due > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                                    >
                                      {formatCurrency(item.due)}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={itemPayments[item.id] || ""}
                                        onChange={(e) =>
                                          updateItemPayment(
                                            month.id,
                                            item.id,
                                            e.target.value,
                                          )
                                        }
                                        disabled={!canEdit}
                                        className="w-28 h-7 px-2 text-right text-[11px] font-semibold rounded-md border bg-background focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                      />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {item.isLateFee &&
                                        item.due > 0 &&
                                        canEdit && (
                                          <button
                                            type="button"
                                            disabled={waivingItemId === item.id}
                                            onClick={() =>
                                              handleWaiveItem(item.id)
                                            }
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

              {monthList.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-sm">No Outstanding Dues</p>
                    <p className="text-xs text-muted-foreground">
                      This student has fully settled all current fee charges.
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
          <Receipt className="w-4 h-4 text-violet-600" /> Payment & Receipt
          Details
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
            <label className="text-xs font-medium block">
              Reference / Cheque No.
            </label>
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
            <label className="text-xs font-medium block">
              Add General Advance (₹)
            </label>
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
              {showPreview
                ? "Hide Allocation Preview"
                : "Preview Payment Breakdown"}
            </button>

            {showPreview && (
              <div className="p-3 bg-muted/30 border rounded-lg space-y-2 text-xs">
                {generatePreview().map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-semibold text-violet-700 dark:text-violet-400">
                      {p.monthTitle}
                    </p>
                    <div className="pl-3 space-y-0.5">
                      {p.allocations.map((a: any, aIdx: number) => (
                        <div
                          key={aIdx}
                          className="flex justify-between text-muted-foreground"
                        >
                          <span>
                            {a.componentName} ({a.newStatus})
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(a.allocated)}
                          </span>
                        </div>
                      ))}
                      {p.surplusAdvance > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Advance Credit (Surplus)</span>
                          <span>{formatCurrency(p.surplusAdvance)}</span>
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
            <span className="text-xs text-muted-foreground font-medium">
              Total Collection:
            </span>
            <span className="text-lg font-black text-violet-700 dark:text-violet-300">
              {formatCurrency(totalPayment)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              disabled={totalPayment <= 0 || isSubmitting || !canEdit}
              onClick={() => handlePayment(false)}
              className="h-10 px-4 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Collect Payment
            </button>

            <button
              type="button"
              disabled={totalPayment <= 0 || isSubmitting || !canEdit}
              onClick={() => handlePayment(true)}
              className="h-10 px-5 bg-violet-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Collect & Print Receipt ({formatCurrency(totalPayment)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Printable Fee Receipt Modal */}
      <FeeReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptData={receiptData}
        autoPrint={autoPrint}
      />
    </div>
  );
}
