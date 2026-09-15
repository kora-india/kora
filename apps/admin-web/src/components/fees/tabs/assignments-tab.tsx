"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@schoolos/utils";
import {
  assignFeeStructureToClass,
  setStudentFeeOverride,
} from "@/lib/actions/fee-settings";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Layers,
  Search,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Edit2,
  Tag,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

interface AssignmentsTabProps {
  classes?: any[];
  structures?: any[];
  sessions?: any[];
  components?: any[];
  students?: any[];
  canEdit?: boolean;
}

export function AssignmentsTab({
  classes = [],
  structures = [],
  sessions = [],
  components = [],
  students = [],
  canEdit = false,
}: Readonly<AssignmentsTabProps>) {
  const [activeSubTab, setActiveSubTab] = useState<"classes" | "students">(
    "classes",
  );
  const [studentData, setStudentData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingClassId, setUpdatingClassId] = useState<string | null>(null);

  // Search & Filter States
  const [classSearch, setClassSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Local state for optimistic UI updates of class assignments
  const [classAssignments, setClassAssignments] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    classes?.forEach((c: any) => {
      map[c.id] = c.classFeeStructures?.[0]?.structureId || "";
    });
    return map;
  });

  // Synchronize when server props update
  useEffect(() => {
    const map: Record<string, string> = {};
    classes?.forEach((c: any) => {
      map[c.id] = c.classFeeStructures?.[0]?.structureId || "";
    });
    setClassAssignments(map);
  }, [classes]);

  const activeSession = sessions.find((s: any) => s.isCurrent) || sessions[0];

  // Sort classes logically by grade
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const gradeA = a.grade ?? 999;
      const gradeB = b.grade ?? 999;
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [classes]);

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return sortedClasses;
    const q = classSearch.toLowerCase();
    return sortedClasses.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedClasses, classSearch]);

  // Total metrics
  const assignedClassesCount =
    Object.values(classAssignments).filter(Boolean).length;
  const unassignedClassesCount = classes.length - assignedClassesCount;

  // Filtered students for overrides
  const filteredStudents = useMemo(() => {
    return students.filter((s: any) => {
      if (studentClassFilter !== "all" && s.classId !== studentClassFilter) {
        return false;
      }
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const nameMatch = s.name.toLowerCase().includes(q);
        const rollMatch = s.rollNumber?.toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return false;
      }
      return true;
    });
  }, [students, studentSearch, studentClassFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / PAGE_SIZE),
  );
  const paginatedStudents = filteredStudents.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const assignClassStructure = async (classId: string, structureId: string) => {
    const prevStructureId = classAssignments[classId] || "";

    // Optimistic UI update
    setClassAssignments((prev) => ({ ...prev, [classId]: structureId }));
    setUpdatingClassId(classId);

    const toastId = `assign-class-${classId}`;
    toast.loading("Updating class fee structure...", { id: toastId });

    try {
      const res = await assignFeeStructureToClass(classId, structureId);
      if (res.error) {
        setClassAssignments((prev) => ({
          ...prev,
          [classId]: prevStructureId,
        }));
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Class fee structure assigned successfully", {
          id: toastId,
        });
      }
    } catch {
      setClassAssignments((prev) => ({ ...prev, [classId]: prevStructureId }));
      toast.error("Failed to update class fee structure", { id: toastId });
    } finally {
      setUpdatingClassId(null);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const componentId = formData.get("componentId") as string;
    const isExempt = formData.get("isExempt") === "on";
    const discountAmount = Number(formData.get("discountAmount") || 0);
    const amountStr = formData.get("amount") as string;
    const amount = amountStr ? Number(amountStr) : undefined;

    const toastId = `override-${studentData?.id}`;
    toast.loading("Saving student fee concession...", { id: toastId });

    try {
      const res = await setStudentFeeOverride(
        studentData.id,
        activeSession.id,
        componentId,
        {
          isExempt,
          discountAmount,
          amount,
        },
      );

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Student override saved successfully", { id: toastId });
        setStudentData(null);
      }
    } catch {
      toast.error("Failed to save override", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP SUMMARY STRIP                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Classes */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Classes
            </p>
            <p className="text-lg font-bold text-foreground">
              {classes.length} Classes
            </p>
            <p className="text-[11px] text-muted-foreground">
              Registered in school
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        {/* Assigned Classes */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Structure Assigned
            </p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {assignedClassesCount} of {classes.length}
            </p>
            <div className="w-28 bg-muted rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{
                  width: `${classes.length > 0 ? (assignedClassesCount / classes.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Unassigned Warning */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unassigned Classes
            </p>
            <p
              className={`text-lg font-bold ${unassignedClassesCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}
            >
              {unassignedClassesCount} Classes
            </p>
            <p className="text-[11px] text-muted-foreground">
              {unassignedClassesCount > 0
                ? "Pending plan setup"
                : "All classes assigned"}
            </p>
          </div>
          <div
            className={`p-3 rounded-xl ${unassignedClassesCount > 0 ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}
          >
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Students Enrolled */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Students
            </p>
            <p className="text-lg font-bold text-foreground">
              {students.length} Students
            </p>
            <p className="text-[11px] text-muted-foreground">
              Ready for fee assignments
            </p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUB-NAVIGATION PILLS                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl w-fit border shadow-sm">
        <button
          type="button"
          onClick={() => setActiveSubTab("classes")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "classes"
              ? "bg-background text-violet-700 dark:text-violet-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Class Structure Assignments
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("students")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "students"
              ? "bg-background text-violet-700 dark:text-violet-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Student Overrides &amp; Concessions
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB VIEW 1: Class Structure Assignments                    */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "classes" && (
        <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Class Fee Structure Mapping
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign standard fee plans to each grade. Student fee charges are
                generated using these mappings.
              </p>
            </div>

            {/* Search Class */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search class..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 w-48 sm:w-60 transition-all"
              />
            </div>
          </div>

          {/* Clean Class List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredClasses.map((c: any) => {
              const assignedId = classAssignments[c.id] || "";
              const assignedStruct = structures.find(
                (s: any) => s.id === assignedId,
              );
              const isUpdating = updatingClassId === c.id;
              const classStudents = students.filter(
                (s: any) => s.classId === c.id,
              );

              const structTotal = assignedStruct?.items?.reduce(
                (sum: number, i: any) =>
                  sum + Number(i.amount || i.component?.amount || 0),
                0,
              );

              return (
                <div
                  key={c.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    assignedStruct
                      ? "bg-background hover:border-violet-300 dark:hover:border-violet-800"
                      : "bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {c.name}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Grade {c.grade ?? "-"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {classStudents.length} Active Students Enrolled
                      </p>
                    </div>

                    {assignedStruct ? (
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/50">
                        {formatCurrency(structTotal || 0)} / mo
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                        Unassigned
                      </span>
                    )}
                  </div>

                  {/* Dropdown Selector */}
                  <div className="pt-2 border-t flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Fee Structure Plan
                      </label>
                      <select
                        className={selectCls + " text-xs"}
                        value={assignedId}
                        onChange={(e) =>
                          assignClassStructure(c.id, e.target.value)
                        }
                        disabled={!canEdit || isUpdating}
                      >
                        <option value="">-- No Structure Assigned --</option>
                        {structures.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isUpdating && (
                      <div className="self-end pb-2">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredClasses.length === 0 && (
              <div className="col-span-full text-center py-10 border border-dashed rounded-xl bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  No classes matched your search.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB VIEW 2: Student Overrides & Concessions                 */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "students" && (
        <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Individual Student Fee Overrides
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Apply student-specific scholarships, sibling concessions, staff
                exemptions, or custom component fees.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Class Filter */}
              <select
                value={studentClassFilter}
                onChange={(e) => {
                  setStudentClassFilter(e.target.value);
                  setPage(1);
                }}
                className={selectCls + " text-xs !w-40"}
              >
                <option value="all">All Classes</option>
                {classes.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search student or roll..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 w-44 sm:w-56 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="border rounded-xl overflow-hidden bg-background">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Roll No</th>
                  <th className="px-4 py-3 font-semibold">Student Name</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Advance Balance</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-semibold">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedStudents.map((s: any) => {
                  const studentClass = classes.find(
                    (c: any) => c.id === s.classId,
                  );
                  const advanceTotal = s.advanceLedgers?.reduce(
                    (sum: number, l: any) => sum + Number(l.amount || 0),
                    0,
                  );

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {s.rollNumber || "-"}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {s.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold">
                          {studentClass?.name || "Class"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {advanceTotal > 0 ? (
                          <span className="font-bold text-emerald-600">
                            +{formatCurrency(advanceTotal)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">₹0</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setStudentData(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:hover:bg-violet-950/60 dark:text-violet-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Tag className="w-3 h-3" />
                            <span>Set Override</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {paginatedStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No students found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t bg-muted/10 text-xs">
                <span className="text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1} -{" "}
                  {Math.min(page * PAGE_SIZE, filteredStudents.length)} of{" "}
                  {filteredStudents.length}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-xs border rounded-lg bg-background hover:bg-muted disabled:opacity-40 cursor-pointer font-medium"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-xs border rounded-lg bg-background hover:bg-muted disabled:opacity-40 cursor-pointer font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. STUDENT OVERRIDE DIALOG                                    */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={!!studentData}
        onOpenChange={(v) => !v && setStudentData(null)}
        title="Configure Student Fee Override"
      >
        <form onSubmit={handleOverrideSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 text-xs">
            <p className="font-bold text-violet-700 dark:text-violet-300">
              Student: {studentData?.name} (
              {studentData?.rollNumber || "No Roll"})
            </p>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              Overrides will take effect during the next periodic fee
              generation.
            </p>
          </div>

          <FormField label="Target Fee Component" required>
            <select name="componentId" className={selectCls} required>
              <option value="">-- Choose fee component --</option>
              {components.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Default: {formatCurrency(Number(c.amount))})
                </option>
              ))}
            </select>
          </FormField>

          <div className="p-4 border rounded-xl bg-muted/20 space-y-3.5">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                name="isExempt"
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
              <span>100% Full Exemption (Waive entire component)</span>
            </label>

            <div className="pt-2 border-t space-y-3">
              <FormField label="Or Apply Flat Concession / Discount (₹)">
                <input
                  type="number"
                  name="discountAmount"
                  className={inputCls}
                  placeholder="e.g. 500 (deducted from bill)"
                />
              </FormField>

              <FormField label="Or Set Specific Fixed Rate (₹)">
                <input
                  type="number"
                  name="amount"
                  className={inputCls}
                  placeholder="e.g. 1500 (replaces default)"
                />
              </FormField>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Student Concession
          </button>
        </form>
      </Dialog>
    </div>
  );
}
