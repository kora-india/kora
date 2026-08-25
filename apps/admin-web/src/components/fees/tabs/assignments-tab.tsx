"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@schoolos/utils";
import { assignFeeStructureToClass, setStudentFeeOverride } from "@/lib/actions/fee-settings";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

export function AssignmentsTab({ classes, structures, sessions, components, students, canEdit }: any) {
  const [studentData, setStudentData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingClassId, setUpdatingClassId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Local state for optimistic UI updates of class assignments
  const [classAssignments, setClassAssignments] = useState<Record<string, string>>(() => {
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

  const filteredStudents = students.filter((s: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term);
  });

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
  const paginatedStudents = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const assignClassStructure = async (classId: string, structureId: string) => {
    const prevStructureId = classAssignments[classId] || "";
    
    // 1. Optimistic UI update (0ms perceived latency)
    setClassAssignments((prev) => ({ ...prev, [classId]: structureId }));
    setUpdatingClassId(classId);

    const toastId = `assign-class-${classId}`;
    toast.loading("Updating class fee structure...", { id: toastId });

    try {
      const res = await assignFeeStructureToClass(classId, structureId);
      if (res.error) {
        // Rollback on server error
        setClassAssignments((prev) => ({ ...prev, [classId]: prevStructureId }));
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Class fee structure updated", { id: toastId });
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
    toast.loading("Saving student fee override...", { id: toastId });

    try {
      const res = await setStudentFeeOverride(studentData.id, activeSession.id, componentId, {
        isExempt, discountAmount, amount
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Student override saved", { id: toastId });
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
      {/* Class Assignments */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Class Structure Assignments</h2>
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Class Name</th>
                <th className="px-4 py-3 text-left font-medium">Assigned Structure</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {classes.map((c: any) => {
                const assigned = classAssignments[c.id] ?? "";
                const isUpdating = updatingClassId === c.id;

                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-xs">
                        <select 
                          className={selectCls + " flex-1"}
                          value={assigned}
                          onChange={(e) => assignClassStructure(c.id, e.target.value)}
                          disabled={!canEdit || isUpdating}
                        >
                          <option value="">-- No Structure Assigned --</option>
                          {structures.filter((s: any) => s.sessionId === activeSession?.id).map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-violet-600 flex-shrink-0" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Overrides */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg font-semibold">Student Individual Overrides (Concessions & Optional Fees)</h2>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search student..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={inputCls + " !w-64 !h-9 text-sm"}
            />
          </div>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Roll No</th>
                <th className="px-4 py-3 text-left font-medium">Student Name</th>
                <th className="px-4 py-3 text-left font-medium">Class</th>
                {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No students found.</td>
                </tr>
              ) : (
                paginatedStudents.map((s: any) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{s.rollNumber}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{classes.find((c: any) => c.id === s.classId)?.name}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setStudentData(s)} className="text-violet-600 hover:underline font-medium text-xs">
                          Add Override
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t bg-muted/10">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs border rounded-md bg-background hover:bg-muted disabled:opacity-50"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs border rounded-md bg-background hover:bg-muted disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Override Dialog */}
      <Dialog open={!!studentData} onOpenChange={(v) => !v && setStudentData(null)} title="Set Fee Override" description={studentData ? `Configuring custom fees for ${studentData.name}` : ""}>
        <form onSubmit={handleOverrideSubmit} className="space-y-4">
          <FormField label="Fee Component" required>
            <select name="componentId" className={selectCls} required>
              <option value="">Select component</option>
              {components.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({formatCurrency(Number(c.amount))})</option>)}
            </select>
          </FormField>
          
          <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="isExempt" />
              Fully Exempt from this component
            </label>
            
            <FormField label="Or Apply Discount Amount (₹)">
              <input type="number" name="discountAmount" className={inputCls} placeholder="e.g. 500" />
            </FormField>
            
            <FormField label="Or Set Custom Absolute Amount (₹) (Overrides default)">
              <input type="number" name="amount" className={inputCls} placeholder="e.g. 1500" />
            </FormField>
          </div>
          
          <button disabled={isSubmitting} type="submit" className="w-full h-10 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 flex items-center justify-center gap-2 disabled:opacity-60">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Override
          </button>
        </form>
      </Dialog>
    </div>
  );
}
