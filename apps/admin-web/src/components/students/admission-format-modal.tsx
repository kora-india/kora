"use client";

import { Dialog } from "@/components/ui/dialog";
import { AdmissionNumberConfigCard } from "@/components/settings/admission-number-config-card";

interface AdmissionFormatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (newFormat: string, newPrefix: string) => void;
}

export function AdmissionFormatModal({
  open,
  onOpenChange,
  onSaved,
}: Readonly<AdmissionFormatModalProps>) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Customize Admission Number Format"
      description="Configure how student admission numbers are generated for your school"
      className="max-w-2xl"
    >
      <div className="pt-2">
        <AdmissionNumberConfigCard
          canEdit={true}
          onSaved={(newFormat, newPrefix) => {
            onSaved?.(newFormat, newPrefix);
            onOpenChange(false);
          }}
        />
      </div>
    </Dialog>
  );
}
