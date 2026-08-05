"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, FileX } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { createFeeType, updateFeeType, toggleFeeTypeActive, deleteFeeType } from "@/lib/actions/fee-types";

const FeeTypeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(60, "Name too long"),
  defaultAmount: z.union([z.coerce.number().nonnegative("Must be positive"), z.literal("")]).optional(),
});

type FeeTypeForm = z.infer<typeof FeeTypeFormSchema>;

interface FeeType {
  id: string;
  name: string;
  defaultAmount: any;
  isActive: boolean;
}

interface Props {
  feeTypes: FeeType[];
  canEdit: boolean;
}

export function FeeTypesContent({ feeTypes, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FeeType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeType | null>(null);

  const form = useForm<FeeTypeForm>({ resolver: zodResolver(FeeTypeFormSchema) });

  const openCreate = () => {
    form.reset({ name: "", defaultAmount: "" });
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (ft: FeeType) => {
    form.reset({ name: ft.name, defaultAmount: ft.defaultAmount ? Number(ft.defaultAmount) : "" });
    setEditTarget(ft);
    setDialogOpen(true);
  };

  const onSubmit = async (data: FeeTypeForm) => {
    const result = editTarget ? await updateFeeType(editTarget.id, data) : await createFeeType(data);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editTarget ? "Fee type updated" : "Fee type added");
    setDialogOpen(false);
    router.refresh();
  };

  const handleToggle = async (ft: FeeType) => {
    const result = await toggleFeeTypeActive(ft.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(ft.isActive ? "Fee type deactivated" : "Fee type activated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteFeeType(deleteTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Fee type removed"); router.refresh(); }
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Fee Configuration"
        description="Manage the fee types available when creating fee records"
        action={
          canEdit ? (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 h-8 px-3 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add Fee Type
            </button>
          ) : undefined
        }
      >
        {feeTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileX className="w-6 h-6 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm font-semibold mb-1">No fee types yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">
              Add fee types like Tuition, Transport, or Lab Fee to reuse when creating fee records.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Fee Type
              </button>
            )}
          </div>
        ) : (
          <ul className="-mx-5 -my-5 divide-y">
            {feeTypes.map((ft) => (
              <li key={ft.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-sm font-medium ${!ft.isActive ? "text-muted-foreground line-through" : ""}`}>{ft.name}</span>
                  {!ft.isActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">
                    {ft.defaultAmount ? formatCurrency(Number(ft.defaultAmount)) : "No default"}
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleToggle(ft)} className="text-xs text-violet-600 hover:underline font-medium">
                        {ft.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button type="button" aria-label="Edit fee type" onClick={() => openEdit(ft)} className="p-1 rounded hover:bg-muted transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button type="button" aria-label="Delete fee type" onClick={() => setDeleteTarget(ft)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editTarget ? "Edit Fee Type" : "Add Fee Type"} className="max-w-sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Name" error={form.formState.errors.name?.message} required>
            <input {...form.register("name")} className={inputCls} placeholder="e.g. Tuition Fee" />
          </FormField>
          <FormField label="Default Amount (₹)" error={form.formState.errors.defaultAmount?.message as string | undefined}>
            <input {...form.register("defaultAmount")} type="number" min={0} step={0.01} className={inputCls} placeholder="Optional" />
          </FormField>
          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setDialogOpen(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={form.formState.isSubmitting} className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {form.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editTarget ? "Save Changes" : "Add Fee Type"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Fee Type"
        description={`Delete "${deleteTarget?.name}"? Existing fee records using this type are not affected.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
