"use client";

import React, { useState, useCallback, useMemo } from "react";
import { formatCurrency } from "@schoolos/utils";
import {
  allocatePayment,
  waiveFeeChargeItem,
  getStudentFeeDues,
  getFeeReceiptDetails,
  type FeeReceiptData,
} from "@/lib/actions/fee-allocator";
import { FeeReceiptModal } from "@/components/fees/fee-receipt-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Search,
  Wallet,
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  Activity,
  ArrowUpRight,
  Bus,
  Printer,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

export function CollectionTab({
  students,
  recentCharges = [],
  components,
  canEdit,
  transactions,
  school,
  onNavigate,
}: any) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [dynamicStudent, setDynamicStudent] = useState<any>(null);
  const [dynamicCharges, setDynamicCharges] = useState<any[]>([]);
  const [loadingDues, setLoadingDues] = useState(false);

  // Month-based Payment States
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
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [generalAdvance, setGeneralAdvance] = useState("");

  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waivingItemId, setWaivingItemId] = useState<string | null>(null);

  // Filter students based on search
  const filteredStudents =
    search.length > 1
      ? students.filter(
          (s: any) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.rollNumber.includes(search),
        )
      : [];

  const refreshCurrentStudent = useCallback(async (studentId: string) => {
    setLoadingDues(true);
    try {
      const res = await getStudentFeeDues(studentId);
      if (res.success && res.student) {
        setDynamicStudent(res.student);
        setDynamicCharges(res.charges || []);
      }
    } catch (e) {
      console.error("Failed to refresh student dues:", e);
    } finally {
      setLoadingDues(false);
    }
  }, []);

  const handleSelectStudent = async (student: any) => {
    setSelectedStudent(student);
    setSearch("");
    setSelectedMonths({});
    setMonthPayments({});
    setItemPayments({});
    setExpandedMonths({});
    setGeneralAdvance("");
    setShowPreview(false);
    await refreshCurrentStudent(student.id);
  };

  // Keep student data fresh
  const currentStudent =
    dynamicStudent ||
    (selectedStudent
      ? students.find((s: any) => s.id === selectedStudent.id) ||
        selectedStudent
      : null);

  // Calculate student dues from dynamic query
  const studentCharges =
    dynamicCharges.length > 0 || dynamicStudent
      ? dynamicCharges
      : currentStudent
        ? recentCharges.filter(
            (c: any) =>
              c.studentId === currentStudent.id && c.status !== "WAIVED",
          )
        : [];

  const advanceBalance =
    currentStudent?.advanceLedgers?.reduce(
      (sum: number, l: any) => sum + Number(l.amount),
      0,
    ) || 0;

  const effectiveSchool = dynamicStudent?.school || school || {};
  const feePaymentMode = effectiveSchool.feePaymentMode || "ALLOW_PARTIAL";
  const minPartialPaymentPercentage = Number(
    effectiveSchool.minPartialPaymentPercentage || 0,
  );
  const minPartialPaymentAmount = Number(
    effectiveSchool.minPartialPaymentAmount || 0,
  );

  // Calculate monthly dues from studentCharges
  const { monthList, totalOutstanding } = useMemo(() => {
    let overallOutstanding = 0;
    const list = (studentCharges || []).map((charge: any) => {
      let monthTotalDue = 0;
      let monthPaid = 0;
      let monthNetCharge = 0;

      const items = (charge.items || []).map((item: any) => {
        const amt = Number(item.amount || 0);
        const paid = Number(item.paidAmount || 0);
        const due = item.status === "WAIVED" ? 0 : Math.max(0, amt - paid);
        const compName =
          item.component?.name ||
          components?.find((c: any) => c.id === item.componentId)?.name ||
          "Fee Component";
        const category =
          item.component?.category ||
          components?.find((c: any) => c.id === item.componentId)?.category;

        monthNetCharge += amt;
        monthPaid += paid;
        monthTotalDue += due;
        overallOutstanding += due;

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
          isLateFee: category === "LATE_FEE",
        };
      });

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
  }, [studentCharges, components]);

  // Handle Month Amount Change with Pro-Rata Auto-Distribution across items
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
        for (const item of charge.items) {
          if (item.due > 0) {
            updatedItemAllocations[item.id] = item.due.toString();
          } else {
            updatedItemAllocations[item.id] = "";
          }
        }
      } else if (charge.totalDue > 0 && eligibleItems.length > 0) {
        let allocatedSum = 0;
        const isIntegerPayment =
          Number.isInteger(enteredAmount) &&
          eligibleItems.every((it: any) => Number.isInteger(it.due));

        eligibleItems.forEach((item: any, idx: number) => {
          if (idx === eligibleItems.length - 1) {
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

  const toggleMonth = (chargeId: string, totalDue: number) => {
    const isSelected = !selectedMonths[chargeId];
    setSelectedMonths((prev) => ({ ...prev, [chargeId]: isSelected }));

    if (isSelected) {
      updateMonthPayment(chargeId, totalDue.toString());
    } else {
      updateMonthPayment(chargeId, "");
    }
  };

  const toggleSelectAll = () => {
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

  // Check if all selected months are being 100% paid
  const isAllCleared = useMemo(() => {
    const activeSelected = monthList.filter((m: any) => selectedMonths[m.id]);
    if (activeSelected.length === 0) return true;
    return activeSelected.every((m: any) => {
      const entered = Number(monthPayments[m.id]) || 0;
      return entered >= m.totalDue;
    });
  }, [monthList, selectedMonths, monthPayments]);

  const generatePreview = () => {
    const preview: any[] = [];

    monthList.forEach((charge: any) => {
      if (!selectedMonths[charge.id]) return;

      const entered = Number(monthPayments[charge.id]) || 0;
      if (entered <= 0) return;

      const isMonthCleared = entered >= charge.totalDue;
      const remainingDue = Math.max(0, charge.totalDue - entered);

      const allocations: any[] = [];
      charge.items.forEach((item: any) => {
        const payVal = Number(itemPayments[item.id]) || 0;
        if (payVal > 0) {
          allocations.push({
            componentName: item.componentName,
            allocated: payVal,
            newStatus:
              item.paidAmount + payVal >= item.amount ? "Paid" : "Partial",
          });
        }
      });

      preview.push({
        chargeTitle: charge.title,
        dueDate: charge.dueDate,
        entered,
        totalDue: charge.totalDue,
        remainingDue,
        isMonthCleared,
        allocations,
      });
    });

    return preview;
  };

  const [receiptModal, setReceiptModal] = useState<{
    open: boolean;
    loadingReceiptNo: string | null;
    data: FeeReceiptData | null;
    autoPrint?: boolean;
  }>({ open: false, loadingReceiptNo: null, data: null, autoPrint: false });

  const handleOpenReceipt = async (receiptNo: string) => {
    setReceiptModal((prev) => ({ ...prev, loadingReceiptNo: receiptNo }));
    try {
      const res = await getFeeReceiptDetails(receiptNo);
      if (res.success && res.data) {
        setReceiptModal({
          open: true,
          loadingReceiptNo: null,
          data: res.data,
          autoPrint: false,
        });
      } else {
        toast.error(res.error || "Failed to load receipt");
        setReceiptModal((prev) => ({ ...prev, loadingReceiptNo: null }));
      }
    } catch {
      toast.error("Failed to fetch receipt");
      setReceiptModal((prev) => ({ ...prev, loadingReceiptNo: null }));
    }
  };

  const handlePayment = async (shouldPrint: boolean = false) => {
    if (totalPayment <= 0) {
      toast.error("Enter payment amounts first.");
      return;
    }

    setIsSubmitting(true);
    const toastId = "payment-process";
    toast.loading("Processing payment transaction...", { id: toastId });

    try {
      // Validate policy
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
            // LOOPHOLE PREVENTION:
            // If remaining due <= minReq, student must pay the remaining balance in full!
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

      const payloadPayments = Object.entries(monthPayments)
        .filter(([id, val]) => selectedMonths[id] && Number(val) > 0)
        .map(([id, val]) => ({ chargeId: id, amount: Number(val) }));

      const res = await allocatePayment({
        studentId: currentStudent.id,
        monthPayments: payloadPayments,
        generalAdvanceAmount:
          Number(generalAdvance) > 0 ? Number(generalAdvance) : undefined,
        method: paymentMethod as any,
        reference: reference || undefined,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        const receiptNo = (res as any).receiptNo || "Receipt Created";
        const docLabel = (res as any).receiptData?.isPartial
          ? "Provisional Invoice"
          : "Official Receipt";
        toast.success(`Payment recorded! ${docLabel}: ${receiptNo}`, {
          id: toastId,
        });
        setMonthPayments({});
        setSelectedMonths({});
        setItemPayments({});
        setGeneralAdvance("");
        setShowPreview(false);

        if ((res as any).receiptData) {
          setReceiptModal({
            open: true,
            loadingReceiptNo: null,
            data: (res as any).receiptData,
            autoPrint: shouldPrint,
          });
        }

        if (currentStudent?.id) {
          await refreshCurrentStudent(currentStudent.id);
        }
        router.refresh();
      }
    } catch {
      toast.error("Payment processing failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Pane: Student Search & Component Ledger */}
      <div className="lg:col-span-2 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search student by name or roll number..."
            className="w-full h-12 pl-10 pr-4 bg-card border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.length > 2 && (
            <div className="absolute top-14 left-0 right-0 bg-card border shadow-lg rounded-xl z-50 max-h-64 overflow-y-auto">
              {filteredStudents.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectStudent(s)}
                  className="w-full text-left p-3 hover:bg-muted border-b flex justify-between items-center"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Roll: {s.rollNumber}
                  </span>
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="p-4 text-sm text-center text-muted-foreground">
                  No students found
                </p>
              )}
            </div>
          )}
        </div>

        {currentStudent ? (
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-5 flex justify-between items-center shadow-sm">
              <div>
                <h2 className="text-xl font-bold">{currentStudent.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Class {currentStudent.class?.name} • Roll No:{" "}
                  {currentStudent.rollNumber}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Total Outstanding:{" "}
                  <span className="font-bold text-red-600">
                    {formatCurrency(totalOutstanding)}
                  </span>
                </p>
              </div>
              <div className="text-right bg-green-50/50 dark:bg-green-950/20 p-4 rounded-lg border border-green-100 dark:border-green-900">
                <p className="text-sm text-muted-foreground">Advance Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(advanceBalance)}
                </p>
              </div>
            </div>

            {(() => {
              const activeTransport = currentStudent?.transports?.[0];
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

            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-600" />
                  <h3 className="font-semibold text-foreground">
                    Outstanding Monthly Fee Dues
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      feePaymentMode === "FULL_ONLY"
                        ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    }`}
                  >
                    {feePaymentMode === "FULL_ONLY" ? (
                      <>
                        <ShieldAlert className="w-3 h-3 text-purple-600" />
                        Full Due Clearance Required
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Partial Allowed{" "}
                        {minPartialPaymentPercentage > 0
                          ? `(Min ${minPartialPaymentPercentage}%)`
                          : minPartialPaymentAmount > 0
                            ? `(Min ₹${minPartialPaymentAmount})`
                            : ""}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/10 border-b">
                    <tr>
                      <th className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded text-violet-600 focus:ring-violet-500"
                          checked={
                            monthList.length > 0 &&
                            monthList.every((m: any) => selectedMonths[m.id])
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Month / Charge
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Net Billed
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Paid
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Remaining Due
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-44">
                        Pay Amount (₹)
                      </th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {monthList.map((charge: any) => {
                      const isExpanded = expandedMonths[charge.id];
                      const enteredVal = monthPayments[charge.id] || "";
                      const enteredNum = Number(enteredVal) || 0;

                      const minRequiredForMonth =
                        minPartialPaymentPercentage > 0
                          ? Math.ceil(
                              (charge.netCharge * minPartialPaymentPercentage) /
                                100,
                            )
                          : minPartialPaymentAmount;

                      // LOOPHOLE PREVENTION: If remaining due <= minRequiredForMonth, student must pay remaining in full
                      const isRemainingBelowThreshold =
                        minRequiredForMonth > 0 &&
                        charge.totalDue <= minRequiredForMonth;
                      const isFullDueOnlyForCharge =
                        feePaymentMode === "FULL_ONLY" ||
                        isRemainingBelowThreshold;

                      const hasPartialWarning =
                        feePaymentMode === "ALLOW_PARTIAL" &&
                        enteredNum > 0 &&
                        (isRemainingBelowThreshold
                          ? enteredNum < charge.totalDue
                          : minRequiredForMonth > 0 &&
                            enteredNum < minRequiredForMonth &&
                            enteredNum < charge.totalDue);

                      return (
                        <React.Fragment key={charge.id}>
                          <tr
                            className={
                              selectedMonths[charge.id]
                                ? "bg-violet-50/30 dark:bg-violet-900/10"
                                : ""
                            }
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                className="rounded text-violet-600 focus:ring-violet-500"
                                checked={!!selectedMonths[charge.id]}
                                onChange={() =>
                                  toggleMonth(charge.id, charge.totalDue)
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">
                                {charge.title}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  Due:{" "}
                                  {new Date(charge.dueDate).toLocaleDateString(
                                    "en-GB",
                                    {
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                                    charge.status === "PARTIAL"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-red-50 text-red-700 border-red-200"
                                  }`}
                                >
                                  {charge.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">
                              {formatCurrency(charge.netCharge)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(charge.paidAmount)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                              {formatCurrency(charge.totalDue)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  disabled={isFullDueOnlyForCharge}
                                  className={`w-full text-right bg-background border rounded-md p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none ${
                                    isFullDueOnlyForCharge
                                      ? "opacity-80 bg-muted/40 cursor-not-allowed font-semibold text-violet-700 dark:text-violet-300"
                                      : hasPartialWarning
                                        ? "border-red-400 focus:ring-red-400"
                                        : ""
                                  }`}
                                  placeholder="0.00"
                                  value={enteredVal}
                                  onChange={(e) =>
                                    updateMonthPayment(
                                      charge.id,
                                      e.target.value,
                                    )
                                  }
                                />
                                {feePaymentMode === "FULL_ONLY" && (
                                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                                    Full due only
                                  </span>
                                )}
                                {feePaymentMode === "ALLOW_PARTIAL" &&
                                  isRemainingBelowThreshold && (
                                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                      Full remainder required (≤{" "}
                                      {minPartialPaymentPercentage > 0
                                        ? `${minPartialPaymentPercentage}%`
                                        : `₹${minRequiredForMonth}`}
                                      )
                                    </span>
                                  )}
                                {hasPartialWarning &&
                                  !isRemainingBelowThreshold && (
                                    <span className="block text-[10px] text-red-500 font-medium mt-0.5">
                                      Min pay:{" "}
                                      {minPartialPaymentPercentage > 0
                                        ? `${minPartialPaymentPercentage}% (₹${minRequiredForMonth})`
                                        : `₹${minRequiredForMonth}`}
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedMonths((prev) => ({
                                    ...prev,
                                    [charge.id]: !isExpanded,
                                  }))
                                }
                                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                                title="View Component Breakdown"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-muted/5">
                              <td colSpan={7} className="p-0 border-b">
                                <div className="px-10 py-3 bg-muted/10 inset-shadow-sm">
                                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Component Breakdown ({charge.title})
                                  </p>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-muted text-muted-foreground">
                                        <th className="py-1.5 text-left font-medium">
                                          Component
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                          Amount
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                          Paid
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                          Remaining Due
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                          This Payment
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                          Status / Action
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-muted/40">
                                      {charge.items.map((item: any) => (
                                        <tr
                                          key={item.id}
                                          className="hover:bg-muted/20"
                                        >
                                          <td className="py-2 text-foreground font-medium">
                                            {item.componentName}
                                          </td>
                                          <td className="py-2 text-right text-muted-foreground">
                                            {formatCurrency(item.amount)}
                                          </td>
                                          <td className="py-2 text-right text-emerald-600 font-medium">
                                            {formatCurrency(item.paidAmount)}
                                          </td>
                                          <td className="py-2 text-right font-bold text-red-600">
                                            {formatCurrency(item.due)}
                                          </td>
                                          <td className="py-2 text-right font-medium text-violet-600">
                                            {itemPayments[item.id]
                                              ? formatCurrency(
                                                  Number(itemPayments[item.id]),
                                                )
                                              : "-"}
                                          </td>
                                          <td className="py-2 text-right">
                                            {item.status === "PAID" ? (
                                              <span className="text-green-600 font-medium inline-flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />{" "}
                                                Paid
                                              </span>
                                            ) : item.status === "WAIVED" ? (
                                              <span className="text-muted-foreground font-medium">
                                                Waived
                                              </span>
                                            ) : (
                                              <div className="flex justify-end items-center gap-2">
                                                <span className="text-amber-600 font-medium text-[11px]">
                                                  {item.paidAmount > 0
                                                    ? "Partial"
                                                    : "Pending"}
                                                </span>
                                                {item.isLateFee && canEdit && (
                                                  <button
                                                    disabled={
                                                      waivingItemId === item.id
                                                    }
                                                    onClick={async () => {
                                                      setWaivingItemId(item.id);
                                                      const toastId = `waive-${item.id}`;
                                                      toast.loading(
                                                        "Waiving late fee...",
                                                        { id: toastId },
                                                      );
                                                      try {
                                                        const res =
                                                          await waiveFeeChargeItem(
                                                            item.id,
                                                          );
                                                        if (res.error)
                                                          toast.error(
                                                            res.error,
                                                            { id: toastId },
                                                          );
                                                        else {
                                                          toast.success(
                                                            "Late fee waived",
                                                            { id: toastId },
                                                          );
                                                          if (
                                                            currentStudent?.id
                                                          ) {
                                                            await refreshCurrentStudent(
                                                              currentStudent.id,
                                                            );
                                                          }
                                                          router.refresh();
                                                        }
                                                      } catch {
                                                        toast.error(
                                                          "Failed to waive late fee",
                                                          { id: toastId },
                                                        );
                                                      } finally {
                                                        setWaivingItemId(null);
                                                      }
                                                    }}
                                                    className="text-[10px] px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 font-medium flex items-center gap-1 disabled:opacity-50"
                                                  >
                                                    {waivingItemId ===
                                                      item.id && (
                                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                    )}
                                                    Waive
                                                  </button>
                                                )}
                                              </div>
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
                          className="p-8 text-center text-muted-foreground"
                        >
                          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="font-semibold text-foreground">
                            All dues cleared!
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This student has no outstanding monthly fee dues.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fee Charge History Table */}
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm mt-6">
              <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-violet-600" /> Fee Charge
                  History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/10 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Charge Title
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Due Month
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Paid
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {studentCharges.map((charge: any) => {
                      const chargeTotal = charge.items.reduce(
                        (sum: number, i: any) => sum + Number(i.amount),
                        0,
                      );
                      const chargePaid = charge.items.reduce(
                        (sum: number, i: any) => sum + Number(i.paidAmount),
                        0,
                      );
                      return (
                        <tr key={charge.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">
                            {charge.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(charge.dueDate).toLocaleDateString(
                              "en-GB",
                              { month: "short", year: "numeric" },
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(chargeTotal)}
                          </td>
                          <td className="px-4 py-3 text-right text-green-600">
                            {formatCurrency(chargePaid)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${charge.status === "PAID" ? "bg-green-50 text-green-700 border-green-200" : charge.status === "PARTIAL" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}`}
                            >
                              {charge.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {studentCharges.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-muted-foreground"
                        >
                          No fee charges generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-dashed rounded-xl h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-20" />
            <p>Search and select a student to view their monthly fee dues</p>
          </div>
        )}

        {/* Global Recent Payments (shows regardless of selected student) */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm mt-8">
          <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" /> Recent Payments
              Activity
            </h3>
            <button
              onClick={() => onNavigate?.("logs")}
              className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/10 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Receipt / Invoice No
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Method
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions?.slice(0, 5).map((txn: any) => {
                  const isPartialTxn = txn.allocations?.some(
                    (a: any) =>
                      a.chargeItem?.charge?.status !== "PAID" &&
                      a.chargeItem?.status !== "PAID",
                  );
                  return (
                    <tr key={txn.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(txn.receiptNo)}
                            disabled={
                              receiptModal.loadingReceiptNo === txn.receiptNo
                            }
                            className="font-medium text-violet-600 hover:text-violet-700 inline-flex items-center gap-1 cursor-pointer"
                            title="View & Print Document"
                          >
                            {receiptModal.loadingReceiptNo === txn.receiptNo ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Printer className="w-3.5 h-3.5" />
                            )}
                            {txn.receiptNo}
                          </button>
                          {isPartialTxn ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                              Invoice
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                              Bill
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{txn.student?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {formatCurrency(Number(txn.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted">
                          {txn.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!transactions || transactions.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No recent payments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Pane: Payment Collection Form */}
      <div className="space-y-6">
        <div
          className={`bg-card border rounded-xl p-6 shadow-sm sticky top-6 ${!currentStudent ? "opacity-50 pointer-events-none" : ""}`}
        >
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-violet-500" /> Payment Summary
          </h2>

          <div className="space-y-5">
            <div className="bg-muted/30 p-4 rounded-xl border border-dashed flex justify-between items-center">
              <span className="font-medium text-muted-foreground">
                Total Payment
              </span>
              <span className="text-2xl font-black text-violet-600">
                {formatCurrency(totalPayment)}
              </span>
            </div>

            {/* Document Type Indicator */}
            {totalPayment > 0 && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  isAllCleared
                    ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {isAllCleared ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Document: Official Fee Receipt</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Document: Provisional Fee Invoice</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] mt-1 text-muted-foreground">
                  {isAllCleared
                    ? "Full monthly fee receipt will be generated. All dues settled."
                    : "A provisional dues invoice will be generated. The official receipt is locked until remaining dues are 100% cleared."}
                </p>
              </div>
            )}

            <FormField label="Payment Method">
              <select
                className={selectCls}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEBIT_CARD">Debit / Credit Card</option>
              </select>
            </FormField>

            <FormField label="Reference Number (Optional)">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. UPI Txn ID"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </FormField>

            {!showPreview ? (
              <button
                onClick={() => setShowPreview(true)}
                disabled={!canEdit || totalPayment <= 0}
                className="w-full h-12 bg-muted text-foreground border rounded-xl font-medium hover:bg-muted/80 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Preview Allocation
              </button>
            ) : (
              <div className="space-y-4 pt-4 border-t border-dashed">
                <h4 className="font-bold text-sm">Allocation Preview</h4>
                <div className="text-xs space-y-3 bg-muted/20 p-3 rounded-lg border">
                  {generatePreview().map((p, idx) => (
                    <div
                      key={idx}
                      className="space-y-1.5 pb-2 border-b last:border-0 border-muted"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">
                          {p.chargeTitle}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            p.isMonthCleared
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {p.isMonthCleared
                            ? "Full Settlement"
                            : `Remaining: ₹${p.remainingDue}`}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex justify-between">
                        <span>Allocating:</span>
                        <span className="font-semibold text-violet-600">
                          {formatCurrency(p.entered)}
                        </span>
                      </div>
                      {p.allocations.map((a: any, i: number) => (
                        <div
                          key={i}
                          className="flex justify-between text-muted-foreground pl-2 text-[11px]"
                        >
                          <span>• {a.componentName}</span>
                          <span>
                            {formatCurrency(a.allocated)} (
                            <span
                              className={
                                a.newStatus === "Paid"
                                  ? "text-green-600 font-medium"
                                  : "text-amber-500 font-medium"
                              }
                            >
                              {a.newStatus}
                            </span>
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreview(false)}
                      className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-muted cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => handlePayment(false)}
                      className="flex-1 py-2.5 border border-neutral-300 dark:border-neutral-700 bg-background hover:bg-muted rounded-xl font-semibold text-xs sm:text-sm transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      Confirm Only
                    </button>
                  </div>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handlePayment(true)}
                    className={`w-full py-3 text-white rounded-xl font-bold text-sm transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100 cursor-pointer ${
                      isAllCleared
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                        : "bg-violet-600 hover:bg-violet-700 shadow-violet-500/20"
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    {isAllCleared
                      ? "Confirm & Print Official Bill"
                      : "Confirm & Print Dues Invoice"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fee Receipt Modal */}
      <FeeReceiptModal
        isOpen={receiptModal.open}
        onClose={() =>
          setReceiptModal({
            open: false,
            loadingReceiptNo: null,
            data: null,
            autoPrint: false,
          })
        }
        receiptData={receiptModal.data}
        autoPrint={receiptModal.autoPrint}
      />
    </div>
  );
}
