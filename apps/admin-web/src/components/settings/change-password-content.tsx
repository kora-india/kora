"use client";

import { KeyRound } from "lucide-react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export function ChangePasswordContent() {
  return (
    <SettingsCard
      icon={KeyRound}
      title="Change Password"
      description="Update the password used to sign in to your account"
    >
      <ChangePasswordForm />
    </SettingsCard>
  );
}
