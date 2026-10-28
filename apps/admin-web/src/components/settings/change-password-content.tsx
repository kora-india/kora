"use client";

import { SettingsCard } from "@/components/settings/settings-card";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export function ChangePasswordContent() {
  return (
    <SettingsCard
      title="Change Password"
      description="Update the password used to sign in to your account"
    >
      <ChangePasswordForm />
    </SettingsCard>
  );
}
