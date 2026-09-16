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
  CheckSquare,
  Square,
  Search,
} from "lucide-react";
import { FormField, inputCls } from "@/components/ui/form-field";
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
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState("");
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

  // Student count by class map
  const studentCountByClass = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of students) {
      if (s.classId) {
        map[s.classId] = (map[s.classId] || 0) + 1;
      }
    }
    return map;
  }, [students]);

  // Structure by class map
  const structureByClass = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of classes) {
      const structId = c.classFeeStructures?.[0]?.structureId;
      if (structId) {
        const struct = structures.find((s: any) => s.id === structId);
        if (struct) map[c.id] = struct;
      }
    }
    return map;
  }, [classes, structures]);

  // Fee per student by class
  const feePerStudentByClass = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of classes) {
      const struct = structureByClass[c.id];
      if (struct?.items) {
        map[c.id] = struct.items.reduce(
          (sum: number, item: any) =>
            sum + Number(item.amount || item.component?.amount || 0),
          0,
        );
      } else {
        map[c.id] = 0;
      }
    }
    return map;
  }, [classes, structureByClass]);

  // Selected classes metadata
  const selectedClasses = useMemo(() => {
    const idSet = new Set(selectedClassIds);
    return classes.filter((c: any) => idSet.has(c.id));
  }, [classes, selectedClassIds]);

  const classesWithPlan = useMemo(() => {
    return selectedClasses.filter((c: any) => Boolean(structureByClass[c.id]));
  }, [selectedClasses, structureByClass]);

  const classesWithoutPlan = useMemo(() => {
    return selectedClasses.filter((c: any) => !structureByClass[c.id]);
  }, [selectedClasses, structureByClass]);

  const totalStudentsInSelection = useMemo(() => {
    return selectedClasses.reduce(
      (sum: number, c: any) => sum + (studentCountByClass[c.id] || 0),
      0,
    );
  }, [selectedClasses, studentCountByClass]);

  const totalEstimatedBilling = useMemo(() => {
    return classesWithPlan.reduce((sum: number, c: any) => {
      const count = studentCountByClass[c.id] || 0;
      const fee = feePerStudentByClass[c.id] || 0;
      return sum + count * fee;
    }, 0);
  }, [classesWithPlan, studentCountByClass, feePerStudentByClass]);

  // Filtered classes for the selector grid
  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    const q = classSearch.toLowerCase().trim();
    return classes.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [classes, classSearch]);

  const allReadyClasses = useMemo(() => {
    return classes.filter((c: any) => Boolean(structureByClass[c.id]));
  }, [classes, structureByClass]);

  // Toggle single class
  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  // Select all classes
  const selectAllClasses = () => {
    setSelectedClassIds(classes.map((c: any) => c.id));
  };

  // Select only classes with fee plans
  const selectReadyOnly = () => {
    setSelectedClassIds(allReadyClasses.map((c: any) => c.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedClassIds([]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (selectedClassIds.length === 0) {
      toast.error("Please select at least one class to generate fees");
      return;
    }

    if (!feeTitle.trim() || !dueDate) {
      toast.error(
        "Please provide both a fee charge title and a payment due date",
      );
      return;
    }

    if (!activeSession) {
      toast.error(
        "No active academic session found. Set an active session first.",
      );
      return;
    }

    if (classesWithPlan.length === 0) {
      toast.error(
        "None of the selected classes have an assigned fee plan. Assign fee structures in Class & Student Setup first.",
      );
      return;
    }

    setLoading(true);
    // Send the ready classes with plans to be billed
    const targetClassIds = classesWithPlan.map((c: any) => c.id);
    const res = await generateMonthlyFees(
      activeSession.id,
      targetClassIds,
      feeTitle,
      dueDate,
    );
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        `Generated periodic fee obligations for ${res.generatedCount} students across ${classesWithPlan.length} classes successfully!`,
      );
      if (res.skippedOrErrors && res.skippedOrErrors.length > 0) {
        toast.info(
          `Note: ${res.skippedOrErrors.length} classes were skipped or encountered warnings.`,
        );
      }
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

              {/* Multi-Class Target Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    Target Classes / Grades{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {selectedClassIds.length} of {classes.length} selected
                  </span>
                </div>

                {/* Quick Selection Shortcuts */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllClasses}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-muted/70 hover:bg-muted text-foreground border border-border transition-colors cursor-pointer"
                    >
                      Select All ({classes.length})
                    </button>
                    <button
                      type="button"
                      onClick={selectReadyOnly}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/40 transition-colors cursor-pointer"
                    >
                      Ready Only ({allReadyClasses.length})
                    </button>
                  </div>
                  {selectedClassIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {/* Search / Filter Input */}
                {classes.length > 6 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter classes by name..."
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border bg-muted/20 focus:bg-background focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-muted-foreground/70"
                    />
                  </div>
                )}

                {/* Class Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1.5 border rounded-xl bg-muted/10">
                  {filteredClasses.map((c: any) => {
                    const isSelected = selectedClassIds.includes(c.id);
                    const hasPlan = Boolean(structureByClass[c.id]);
                    const studentCount = studentCountByClass[c.id] || 0;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleClass(c.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-violet-600 bg-violet-50/70 dark:bg-violet-950/40 shadow-xs ring-1 ring-violet-500/30"
                            : "border-border/70 bg-card hover:bg-muted/40"
                        }`}
                      >
                        <div className="mt-0.5 text-violet-600 dark:text-violet-400 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-bold text-foreground truncate leading-tight">
                            {c.name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {studentCount}{" "}
                              {studentCount === 1 ? "student" : "students"}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50">
                              •
                            </span>
                            {hasPlan ? (
                              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                No Plan
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {filteredClasses.length === 0 && (
                    <div className="col-span-full text-center py-6 text-xs text-muted-foreground">
                      No classes found matching &quot;{classSearch}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* Pre-Flight Inspection Card for Selected Classes */}
              {selectedClassIds.length > 0 && (
                <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Cohort Inspection Pre-Flight
                    </span>
                    {classesWithoutPlan.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> All{" "}
                        {selectedClassIds.length} Classes Ready
                      </span>
                    ) : classesWithPlan.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <AlertTriangle className="w-3 h-3" />{" "}
                        {classesWithPlan.length} Ready,{" "}
                        {classesWithoutPlan.length} Missing Plan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        <AlertTriangle className="w-3 h-3" /> Missing Fee
                        Structures
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t">
                    <div>
                      <p className="text-muted-foreground text-[11px]">
                        Target Scope
                      </p>
                      <p className="font-bold text-foreground">
                        {selectedClassIds.length}{" "}
                        {selectedClassIds.length === 1 ? "Class" : "Classes"} (
                        {classesWithPlan.length} ready)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px]">
                        Enrolled Students
                      </p>
                      <p className="font-bold text-foreground">
                        {totalStudentsInSelection} Students
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px]">
                        Est. Total Batch
                      </p>
                      <p className="font-bold text-emerald-600">
                        {formatCurrency(totalEstimatedBilling)}
                      </p>
                    </div>
                  </div>

                  {classesWithoutPlan.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                      ⚠️ Note: The following{" "}
                      {classesWithoutPlan.length === 1
                        ? "class lacks"
                        : "classes lack"}{" "}
                      an assigned fee structure and will be skipped during
                      generation:{" "}
                      <span className="font-bold">
                        {classesWithoutPlan.map((c: any) => c.name).join(", ")}
                      </span>
                      . You can assign fee structures in the Class &amp; Student
                      Setup tab.
                    </p>
                  )}

                  {classesWithPlan.length === 0 && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                      ⚠️ You cannot generate fees until at least one selected
                      class has an assigned Fee Structure in Class &amp; Student
                      Setup.
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
                  loading ||
                  !canEdit ||
                  selectedClassIds.length === 0 ||
                  classesWithPlan.length === 0
                }
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      Processing Batch Generation ({classesWithPlan.length}{" "}
                      Classes)...
                    </span>
                  </>
                ) : selectedClassIds.length === 0 ? (
                  <span>Select Target Classes to Generate Fees</span>
                ) : (
                  <>
                    <span>
                      Generate Fee Charges for {classesWithPlan.length}{" "}
                      {classesWithPlan.length === 1 ? "Class" : "Classes"} (
                      {totalStudentsInSelection} Students)
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
