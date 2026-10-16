"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, textareaCls } from "@/components/ui/form-field";

interface WaiveReasonDialogProps {
  /** The item being waived, or null when the dialog is closed. */
  target: { id: string; label: string } | null;
  onClose: () => void;
  /** Resolves true when the waiver succeeded and the dialog should close. */
  onConfirm: (itemId: string, reason: string) => Promise<boolean>;
}

/** Asks for the reason recorded with a fee waiver. */
export function WaiveReasonDialog({
  target,
  onClose,
  onConfirm,
}: Readonly<WaiveReasonDialogProps>) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) setReason("");
  }, [target]);

  const trimmed = reason.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || trimmed.length < 3) return;
    setSubmitting(true);
    try {
      if (await onConfirm(target.id, trimmed)) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
      title="Waive fee"
      description={
        target ? `Waive the unpaid amount of ${target.label}.` : undefined
      }
      className="max-w-md"
      zIndex={1100}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Reason" required>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Late payment approved by principal"
            className={textareaCls}
            autoFocus
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          The reason and your name are saved with the waiver. Any amount already
          paid on this item is kept as advance credit for the student.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || trimmed.length < 3}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Waive
          </button>
        </div>
      </form>
    </Dialog>
  );
}
