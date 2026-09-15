"use client";

import React, { useState, useMemo } from "react";
import { generateMonthlyFees } from "@/lib/actions/fee-generator";
import { toast } from "sonner";
import {
  Loader2,
  Calendar,
  Sparkles,
  Layers,
  Users,
  AlertTriangle,
  History,
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";
import { formatCurrency } from "@schoolos/utils";

interface GeneratorTabProps {
  sessions?: any[];
  classes?: any[];
  structures?: any[];
  students?: any[];
  recentCharges?: any[];
  canEdit?: boolean;
}

export function GeneratorTab({
  sessions = [],
  classes = [],
  structures = [],
  students = [],
  recentCharges = [],
  canEdit = false,
}: Readonly<GeneratorTabProps>) {
  const [loading, setLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [feeTitle, setFeeTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const activeSession = sessions.find((s: any) => s.isCurrent) || sessions[0];

  // Helper date presets for quick title selection
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const now = new Date();
  const currentMonthTitle = `${monthNames[now.getMonth()]} ${now.getFullYear()} Tuition Fee`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthTitle = `${monthNames[nextMonthDate.getMonth()]} ${nextMonthDate.getFullYear()} Tuition Fee`;

  // Pre-flight validation for selected class
  const selectedClass = classes.find((c: any) => c.id === selectedClassId);
  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((s: any) => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  const assignedStructureId =
    selectedClass?.classFeeStructures?.[0]?.structureId;
  const assignedStructure = structures.find(
    (s: any) => s.id === assignedStructureId,
  );

  const estimatedFeePerStudent = useMemo(() => {
    if (!assignedStructure?.items) return 0;
    return assignedStructure.items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.amount || item.component?.amount || 0),
      0,
    );
  }, [assignedStructure]);

  const estimatedTotalBilling = estimatedFeePerStudent * studentsInClass.length;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!selectedClassId || !feeTitle.trim() || !dueDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!activeSession) {
      toast.error(
        "No active academic session found. Set an active session first.",
      );
      return;
    }

    if (!assignedStructure) {
      toast.error(
        `Class "${selectedClass?.name}" does not have a fee structure assigned. Assign one in Class & Student Setup first.`,
      );
      return;
    }

    setLoading(true);
    const res = await generateMonthlyFees(
      activeSession.id,
      selectedClassId,
      feeTitle,
      dueDate,
    );
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        `Generated periodic fee obligations for ${res.generatedCount} students successfully`,
      );
      setFeeTitle("");
      setDueDate("");
    }
  };

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP SUMMARY STRIP                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Session */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Cycle
            </p>
            <p className="text-lg font-bold text-foreground">
              {activeSession?.name || "None"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {activeSession?.isCurrent
                ? "Current Active Session"
                : "Fallback Session"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Classes Available */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Eligible Classes
            </p>
            <p className="text-lg font-bold text-foreground">
              {classes.length} Classes
            </p>
            <p className="text-[11px] text-muted-foreground">
              {
                classes.filter((c: any) => c.classFeeStructures?.length > 0)
                  .length
              }{" "}
              with assigned structures
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Active Enrolled Students */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Enrolled
            </p>
            <p className="text-lg font-bold text-foreground">
              {students.length} Students
            </p>
            <p className="text-[11px] text-muted-foreground">
              Across all registered grades
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Recent Charges Count */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Generated Records
            </p>
            <p className="text-lg font-bold text-foreground">
              {recentCharges.length} Charges
            </p>
            <p className="text-[11px] text-muted-foreground">
              Logged in school ledger
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN 2-COLUMN BALANCED LAYOUT                              */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): The Fee Generation Console */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Periodic Fee Generation Console
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Batch-generate billing charges for student cohorts based on
                  class fee plans.
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Quick Title Presets */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Month Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFeeTitle(currentMonthTitle)}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-muted/60 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-300 border border-border transition-colors cursor-pointer"
                  >
                    {currentMonthTitle}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeTitle(nextMonthTitle)}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-muted/60 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-300 border border-border transition-colors cursor-pointer"
                  >
                    {nextMonthTitle}
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <FormField label="Fee Charge Title" required>
                <input
                  value={feeTitle}
                  onChange={(e) => setFeeTitle(e.target.value)}
                  placeholder="e.g. October 2026 Tuition & Activity"
                  className={inputCls}
                  required
                />
              </FormField>

              {/* Target Class Selector */}
              <FormField label="Target Class / Grade" required>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className={selectCls}
                  required
                >
                  <option value="">-- Choose a target class --</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* Pre-Flight Inspection Card */}
              {selectedClass && (
                <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Class Inspection Pre-Flight
                    </span>
                    {assignedStructure ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Ready to Bill
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        <AlertTriangle className="w-3 h-3" /> Missing Structure
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t">
                    <div>
                      <p className="text-muted-foreground text-[11px]">
                        Enrolled Students
                      </p>
                      <p className="font-bold text-foreground">
                        {studentsInClass.length} Students
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px]">
                        Assigned Plan
                      </p>
                      <p className="font-bold text-foreground truncate">
                        {assignedStructure?.name || "None"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px]">
                        Est. Total Batch
                      </p>
                      <p className="font-bold text-emerald-600">
                        {formatCurrency(estimatedTotalBilling)}
                      </p>
                    </div>
                  </div>

                  {!assignedStructure && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                      ⚠️ You cannot generate fees for this class until a Fee
                      Structure is assigned in the &quot;Class &amp; Student
                      Setup&quot; tab.
                    </p>
                  )}
                </div>
              )}

              {/* Due Date Picker */}
              <FormField label="Payment Due Date" required>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </FormField>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  loading || !canEdit || !selectedClassId || !assignedStructure
                }
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Batch Generation...</span>
                  </>
                ) : (
                  <>
                    <span>
                      Generate Fee Charges for {selectedClass?.name || "Class"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (5 Cols): Generation Rules & History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Automated Settlement Rules */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2.5 pb-2 border-b">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Automated Engine Rules
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  What happens during generation
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-muted/40 border space-y-1">
                <p className="font-bold text-foreground">
                  1. Auto Advance Deductions
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  If any student has an existing positive balance in their
                  Advance Ledger, the engine automatically settles it against
                  new dues and reduces the payable amount.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/40 border space-y-1">
                <p className="font-bold text-foreground">
                  2. Concessions &amp; Exemptions
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Individual student overrides (scholarships, staff wards,
                  component waivers) are respected and billed accordingly.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/40 border space-y-1">
                <p className="font-bold text-foreground">
                  3. Active Transport Integration
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Students enrolled in active bus routes have their transport
                  stop fare appended automatically as optional dues.
                </p>
              </div>
            </div>
          </div>

          {/* Recent Generation History */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Recent Fee Batches
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                {recentCharges.slice(0, 5).length} shown
              </span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {recentCharges.slice(0, 8).map((charge: any) => {
                const totalAmt = charge.items?.reduce(
                  (sum: number, i: any) => sum + Number(i.amount || 0),
                  0,
                );
                return (
                  <div
                    key={charge.id}
                    className="p-3 rounded-xl border bg-background hover:bg-muted/20 transition-all flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-foreground">
                        {charge.title}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Student: {charge.student?.name || "Student"} • Due:{" "}
                        {new Date(charge.dueDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="font-black text-foreground">
                        {formatCurrency(totalAmt)}
                      </p>
                      <span
                        className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          charge.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : charge.status === "PARTIAL"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {charge.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {recentCharges.length === 0 && (
                <div className="text-center py-8 border border-dashed rounded-xl bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    No recent fee charges generated yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
