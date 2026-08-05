"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Layers, X } from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import { createFeeStructure, updateFeeStructure, deleteFeeStructure } from "@/lib/actions/fee-structures";

const FeeStructureFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(60, "Name too long"),
  items: z
    .array(
      z.object({
        name: z.string().min(1, "Required"),
        amount: z.coerce.number().nonnegative("Must be positive"),
      })
    )
    .min(1, "Add at least one fee line item"),
  classIds: z.array(z.string()),
});

type FeeStructureForm = z.infer<typeof FeeStructureFormSchema>;

interface FeeStructureItem {
  id: string;
  name: string;
  amount: any;
}

interface FeeStructure {
  id: string;
  name: string;
  items: FeeStructureItem[];
  classes: { id: string; name: string }[];
}

interface ClassOption {
  id: string;
  name: string;
  feeStructureId: string | null;
}

interface Props {
  structures: FeeStructure[];
  classes: ClassOption[];
  feeTypeNames: string[];
  canEdit: boolean;
}

export function FeeStructuresContent({ structures, classes, feeTypeNames, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FeeStructure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeStructure | null>(null);

  const form = useForm<FeeStructureForm>({
    resolver: zodResolver(FeeStructureFormSchema),
    defaultValues: { name: "", items: [{ name: "", amount: 0 }], classIds: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const openCreate = () => {
    form.reset({ name: "", items: [{ name: "", amount: 0 }], classIds: [] });
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (structure: FeeStructure) => {
    form.reset({
      name: structure.name,
      items: structure.items.map((i) => ({ name: i.name, amount: Number(i.amount) })),
      classIds: structure.classes.map((c) => c.id),
    });
    setEditTarget(structure);
    setDialogOpen(true);
  };

  const onSubmit = async (data: FeeStructureForm) => {
    const result = editTarget ? await updateFeeStructure(editTarget.id, data) : await createFeeStructure(data);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editTarget ? "Fee structure updated" : "Fee structure created");
    setDialogOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteFeeStructure(deleteTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Fee structure removed"); router.refresh(); }
  };

  const structureTotal = (structure: FeeStructure) =>
    structure.items.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Fee Structures</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Build reusable sets of fees and assign them to classes — assign the same structure to multiple classes to keep them identical
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 h-8 px-3 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Fee Structure
          </button>
        )}
      </div>

      {structures.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-muted-foreground opacity-50" />
          </div>
          <p className="text-sm font-semibold mb-1">No fee structures yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Create a fee structure and assign it to one or more classes — e.g. a "Grade 6-8 Standard" structure shared by three classes.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Fee Structure
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {structures.map((structure) => (
            <div key={structure.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{structure.name}</h3>
                    <span className="text-xs text-muted-foreground">{formatCurrency(structureTotal(structure))} total</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {structure.items.map((item) => (
                      <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground">
                        {item.name} · {formatCurrency(Number(item.amount))}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {structure.classes.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Not assigned to any class</span>
                    ) : (
                      structure.classes.map((c) => (
                        <span key={c.id} className="text-[10px] px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800">
                          {c.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" aria-label="Edit fee structure" onClick={() => openEdit(structure)} className="p-1.5 rounded hover:bg-muted transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" aria-label="Delete fee structure" onClick={() => setDeleteTarget(structure)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <datalist id="fee-type-suggestions">
        {feeTypeNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editTarget ? "Edit Fee Structure" : "Add Fee Structure"}
        description="Pick an existing fee type or type a new one — new types are saved for reuse"
        className="max-w-lg"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Structure Name" error={form.formState.errors.name?.message} required>
            <input {...form.register("name")} className={inputCls} placeholder="e.g. Grade 6-8 Standard" />
          </FormField>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Fee Line Items</label>
              <button
                type="button"
                onClick={() => append({ name: "", amount: 0 })}
                className="text-xs text-violet-600 hover:underline font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add line item
              </button>
            </div>
            {form.formState.errors.items?.root && (
              <p className="text-xs text-red-500">{form.formState.errors.items.root.message}</p>
            )}
            {form.formState.errors.items?.message && (
              <p className="text-xs text-red-500">{form.formState.errors.items.message}</p>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <input
                      {...form.register(`items.${index}.name`)}
                      list="fee-type-suggestions"
                      className={inputCls}
                      placeholder="Fee type (e.g. Tuition Fee)"
                    />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <input
                      {...form.register(`items.${index}.amount`)}
                      type="number"
                      min={0}
                      step={0.01}
                      className={inputCls}
                      placeholder="Amount"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove line item"
                    onClick={() => fields.length > 1 && remove(index)}
                    disabled={fields.length === 1}
                    className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium block">Assign to Classes</label>
            <div className="rounded-lg border max-h-40 overflow-y-auto divide-y">
              {classes.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No classes yet.</p>
              ) : (
                classes.map((cls) => (
                  <label key={cls.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors">
                    <input type="checkbox" value={cls.id} {...form.register("classIds")} className="rounded border-muted-foreground/40" />
                    {cls.name}
                    {cls.feeStructureId && cls.feeStructureId !== editTarget?.id && (
                      <span className="ml-auto text-[10px] text-muted-foreground">Reassigns from another structure</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setDialogOpen(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={form.formState.isSubmitting} className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {form.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editTarget ? "Save Changes" : "Create Structure"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Fee Structure"
        description={`Delete "${deleteTarget?.name}"? Classes assigned to it will become unassigned.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
