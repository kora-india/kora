"use client";

import { useState } from "react";
import { formatCurrency } from "@schoolos/utils";
import { Plus, Check, X, Calendar, Layers, Receipt, Edit2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { createAcademicSession, createFeeComponent, createFeeStructure, updateAcademicSession, updateFeeComponent, updateFeeStructure } from "@/lib/actions/fee-settings";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

export function SetupTab({ sessions, components, structures, canEdit }: any) {
  const [sessionDialog, setSessionDialog] = useState(false);
  const [componentDialog, setComponentDialog] = useState(false);
  const [structureDialog, setStructureDialog] = useState(false);

  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editComponentId, setEditComponentId] = useState<string | null>(null);
  const [editStructureId, setEditStructureId] = useState<string | null>(null);

  const sessionForm = useForm({ defaultValues: { name: "", startDate: "", endDate: "", isCurrent: false } });
  const compForm = useForm({ defaultValues: { name: "", amount: 0, frequency: "MONTHLY", isOptional: false } });
  const structForm = useForm({ defaultValues: { name: "", sessionId: "", componentIds: [] as string[], amounts: {} as Record<string, string> } });
  const openSessionDialog = (session?: any) => {
    if (session) {
      setEditSessionId(session.id);
      sessionForm.reset({
        name: session.name,
        startDate: new Date(session.startDate).toISOString().split('T')[0],
        endDate: new Date(session.endDate).toISOString().split('T')[0],
        isCurrent: session.isCurrent
      });
    } else {
      setEditSessionId(null);
      sessionForm.reset({ name: "", startDate: "", endDate: "", isCurrent: false });
    }
    setSessionDialog(true);
  };

  const openComponentDialog = (comp?: any) => {
    if (comp) {
      setEditComponentId(comp.id);
      compForm.reset({
        name: comp.name,
        amount: Number(comp.amount),
        frequency: comp.frequency,
        isOptional: comp.isOptional
      });
    } else {
      setEditComponentId(null);
      compForm.reset({ name: "", amount: 0, frequency: "MONTHLY", isOptional: false });
    }
    setComponentDialog(true);
  };

  const openStructureDialog = (struct?: any) => {
    if (struct) {
      setEditStructureId(struct.id);
      const amounts: Record<string, string> = {};
      struct.items.forEach((i: any) => {
        if (i.amount) amounts[i.componentId] = i.amount.toString();
      });
      structForm.reset({
        name: struct.name,
        sessionId: struct.sessionId,
        componentIds: struct.items.map((i: any) => i.componentId),
        amounts
      });
    } else {
      setEditStructureId(null);
      structForm.reset({ name: "", sessionId: "", componentIds: [], amounts: {} });
    }
    setStructureDialog(true);
  };

  const onSessionSubmit = async (data: any) => {
    const res = editSessionId 
      ? await updateAcademicSession(editSessionId, data)
      : await createAcademicSession(data);
    if (res.error) toast.error(res.error);
    else { toast.success(editSessionId ? "Session updated" : "Session created"); setSessionDialog(false); sessionForm.reset(); }
  };

  const onCompSubmit = async (data: any) => {
    const res = editComponentId
      ? await updateFeeComponent(editComponentId, { ...data, amount: Number(data.amount) })
      : await createFeeComponent({ ...data, amount: Number(data.amount) });
    if (res.error) toast.error(res.error);
    else { toast.success(editComponentId ? "Component updated" : "Component created"); setComponentDialog(false); compForm.reset(); }
  };

  const onStructSubmit = async (data: any) => {
    const components = data.componentIds.map((id: string) => ({
      componentId: id,
      amount: data.amounts?.[id] ? Number(data.amounts[id]) : undefined
    }));
    const payload = { name: data.name, sessionId: data.sessionId, components };
    const res = editStructureId
      ? await updateFeeStructure(editStructureId, payload)
      : await createFeeStructure(payload);
    if (res.error) toast.error(res.error);
    else { toast.success(editStructureId ? "Structure updated" : "Structure created"); setStructureDialog(false); structForm.reset(); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-violet-500" /> Academic Sessions</h2>
          {canEdit && <button onClick={() => openSessionDialog()} className="p-1.5 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200"><Plus className="w-4 h-4" /></button>}
        </div>
        <div className="bg-card border rounded-xl divide-y">
          {sessions.map((s: any) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.startDate).getFullYear()} - {new Date(s.endDate).getFullYear()}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.isCurrent && <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] rounded-full font-medium">Current</span>}
                {canEdit && <button onClick={() => openSessionDialog(s)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
          {sessions.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No sessions defined</p>}
        </div>
      </div>

      {/* Components */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Receipt className="w-5 h-5 text-amber-500" /> Fee Components</h2>
          {canEdit && <button onClick={() => openComponentDialog()} className="p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"><Plus className="w-4 h-4" /></button>}
        </div>
        <div className="bg-card border rounded-xl divide-y">
          {components.map((c: any) => (
            <div key={c.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  {c.name} {c.isOptional && <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground">Optional</span>}
                </p>
                <p className="text-xs text-muted-foreground">{c.frequency}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-sm">{formatCurrency(Number(c.amount))}</p>
                {canEdit && <button onClick={() => openComponentDialog(c)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
          {components.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No components defined</p>}
        </div>
      </div>

      {/* Structures */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-blue-500" /> Fee Structures</h2>
          {canEdit && <button onClick={() => openStructureDialog()} className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"><Plus className="w-4 h-4" /></button>}
        </div>
        <div className="bg-card border rounded-xl divide-y">
          {structures.map((s: any) => (
            <div key={s.id} className="p-4 flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.items.map((i: any) => (
                    <span key={i.id} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded border">
                      {i.component.name}
                    </span>
                  ))}
                </div>
              </div>
              {canEdit && <button onClick={() => openStructureDialog(s)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {structures.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No structures defined</p>}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={sessionDialog} onOpenChange={setSessionDialog} title={editSessionId ? "Edit Academic Session" : "Create Academic Session"}>
        <form onSubmit={sessionForm.handleSubmit(onSessionSubmit)} className="space-y-4">
          <FormField label="Session Name" required><input {...sessionForm.register("name")} className={inputCls} placeholder="e.g. 2026-27" /></FormField>
          <FormField label="Start Date" required><input type="date" {...sessionForm.register("startDate")} className={inputCls} /></FormField>
          <FormField label="End Date" required><input type="date" {...sessionForm.register("endDate")} className={inputCls} /></FormField>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...sessionForm.register("isCurrent")} /> Set as current active session</label>
          <button className="w-full h-10 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700">{editSessionId ? "Save Changes" : "Save Session"}</button>
        </form>
      </Dialog>

      <Dialog open={componentDialog} onOpenChange={setComponentDialog} title={editComponentId ? "Edit Fee Component" : "Create Fee Component"}>
        <form onSubmit={compForm.handleSubmit(onCompSubmit)} className="space-y-4">
          <FormField label="Component Name" required><input {...compForm.register("name")} className={inputCls} placeholder="e.g. Tuition Fee" /></FormField>
          <FormField label="Default Amount" required><input type="number" {...compForm.register("amount")} className={inputCls} /></FormField>
          <FormField label="Frequency" required>
            <select {...compForm.register("frequency")} className={selectCls}>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="HALF_YEARLY">Half Yearly</option>
              <option value="YEARLY">Yearly</option>
              <option value="ONE_TIME">One Time</option>
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...compForm.register("isOptional")} /> Is Optional (e.g. Transport)</label>
          <button className="w-full h-10 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700">{editComponentId ? "Save Changes" : "Save Component"}</button>
        </form>
      </Dialog>

      <Dialog open={structureDialog} onOpenChange={setStructureDialog} title={editStructureId ? "Edit Fee Structure" : "Create Fee Structure"}>
        <form onSubmit={structForm.handleSubmit(onStructSubmit)} className="space-y-4">
          <FormField label="Structure Name" required><input {...structForm.register("name")} className={inputCls} placeholder="e.g. Primary Classes" /></FormField>
          <FormField label="Academic Session" required>
            <select {...structForm.register("sessionId")} className={selectCls}>
              <option value="">Select session</option>
              {sessions.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <div>
            <label className="text-sm font-medium mb-2 block">Select Components</label>
            <div className="space-y-2 border rounded-lg p-3 max-h-[300px] overflow-y-auto">
              {components.map((c: any) => {
                const isSelected = structForm.watch("componentIds").includes(c.id);
                return (
                <div key={c.id} className={`flex flex-col gap-2 p-2 rounded border transition-colors ${isSelected ? 'bg-violet-50/50 border-violet-200' : 'hover:bg-muted'}`}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" value={c.id} {...structForm.register("componentIds")} />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(Number(c.amount))}</span>
                  </label>
                  {isSelected && (
                    <div className="pl-6 flex items-center gap-2">
                       <span className="text-xs text-muted-foreground">Override Amount:</span>
                       <input type="number" {...structForm.register(`amounts.${c.id}`)} className="h-7 w-24 text-xs rounded border px-2 bg-background" placeholder={c.amount} />
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>
          <button className="w-full h-10 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700">{editStructureId ? "Save Changes" : "Save Structure"}</button>
        </form>
      </Dialog>

    </div>
  );
}

