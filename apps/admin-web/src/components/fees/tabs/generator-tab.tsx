"use client";

import { useState } from "react";
import { generateMonthlyFees } from "@/lib/actions/fee-generator";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

export function GeneratorTab({ sessions, classes, canEdit }: any) {
  const [loading, setLoading] = useState(false);
  const activeSession = sessions.find((s: any) => s.isCurrent) || sessions[0];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const classId = formData.get("classId") as string;
    const title = formData.get("title") as string;
    const dueDate = formData.get("dueDate") as string;

    if (!classId || !title || !dueDate) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);
    const res = await generateMonthlyFees(activeSession.id, classId, title, dueDate);
    setLoading(false);

    if (res.error) toast.error(res.error);
    else toast.success(`Generated fee charges for ${res.generatedCount} students successfully`);
  };

  return (
    <div className="max-w-2xl mt-8">
      <div className="bg-card border shadow-sm rounded-xl p-6">
        <h2 className="text-xl font-bold mb-1">Generate Periodic Fees</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Create fee obligations for an entire class based on their assigned fee structure and individual overrides.
        </p>

        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="p-4 bg-muted/30 border rounded-lg mb-4">
            <p className="text-sm font-medium">Active Session: <span className="text-violet-600 font-bold">{activeSession?.name || "None"}</span></p>
          </div>

          <FormField label="Target Class" required>
            <select name="classId" className={selectCls} required>
              <option value="">Select class</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          <FormField label="Fee Title (e.g., April 2026 Tuition)" required>
            <input name="title" className={inputCls} placeholder="e.g. April 2026" required />
          </FormField>

          <FormField label="Due Date" required>
            <input type="date" name="dueDate" className={inputCls} required />
          </FormField>

          <button 
            type="submit" 
            disabled={loading || !canEdit || !activeSession} 
            className="w-full h-11 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate Fee Charges
          </button>
        </form>
      </div>
    </div>
  );
}
