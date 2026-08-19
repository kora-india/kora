"use client";

import { useState } from "react";
import { formatCurrency } from "@schoolos/utils";
import { assignFeeStructureToClass, setStudentFeeOverride } from "@/lib/actions/fee-settings";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

export function AssignmentsTab({ classes, structures, sessions, components, students, canEdit }: any) {
  const [classData, setClassData] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);

  const activeSession = sessions.find((s: any) => s.isCurrent) || sessions[0];

  const assignClassStructure = async (classId: string, structureId: string) => {
    if (!structureId) return;
    const res = await assignFeeStructureToClass(classId, structureId);
    if (res.error) toast.error(res.error);
    else toast.success("Class fee structure updated");
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const componentId = formData.get("componentId") as string;
    const isExempt = formData.get("isExempt") === "on";
    const discountAmount = Number(formData.get("discountAmount") || 0);
    const amountStr = formData.get("amount") as string;
    const amount = amountStr ? Number(amountStr) : undefined;

    const res = await setStudentFeeOverride(studentData.id, activeSession.id, componentId, {
      isExempt, discountAmount, amount
    });

    if (res.error) toast.error(res.error);
    else {
      toast.success("Student override saved");
      setStudentData(null);
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
                const assigned = c.classFeeStructures?.[0]?.structureId;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <select 
                        className={selectCls + " max-w-xs"}
                        value={assigned || ""}
                        onChange={(e) => assignClassStructure(c.id, e.target.value)}
                        disabled={!canEdit}
                      >
                        <option value="">-- No Structure Assigned --</option>
                        {structures.filter((s:any) => s.sessionId === activeSession?.id).map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
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
        <h2 className="text-lg font-semibold mb-4">Student Individual Overrides (Concessions & Optional Fees)</h2>
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
              {students.slice(0, 50).map((s: any) => (
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
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-muted-foreground text-center border-t">Showing top 50 students. Use search to find specific students.</p>
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
          
          <button type="submit" className="w-full h-10 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700">Save Override</button>
        </form>
      </Dialog>
    </div>
  );
}
