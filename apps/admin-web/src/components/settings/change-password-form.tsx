"use client";

import { Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ChangePasswordSchema,
  type ChangePasswordInput,
} from "@schoolos/types";
import { FormField, inputCls } from "@/components/ui/form-field";
import { changePassword } from "@/lib/actions/account";

/**
 * Changing your own password. Changing it signs out every older session,
 * this one included, so the form signs you straight back in with the new
 * password.
 */
export function ChangePasswordForm({
  currentLabel = "Current Password",
  submitLabel = "Update Password",
  onChanged,
}: Readonly<{
  currentLabel?: string;
  submitLabel?: string;
  onChanged?: () => void;
}>) {
  const { data: session } = useSession();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    const result = await changePassword(data);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const email = session?.user?.email;
    const signedIn =
      email &&
      (await signIn("credentials", {
        email,
        password: data.newPassword,
        redirect: false,
      }));
    if (!signedIn || signedIn.error) {
      toast.success("Password changed. Sign in with your new password.");
      await signOut({ callbackUrl: "/login" });
      return;
    }
    toast.success("Password updated");
    form.reset();
    onChanged?.();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
      <FormField
        label={currentLabel}
        htmlFor="current-password"
        error={form.formState.errors.currentPassword?.message}
        required
      >
        <div className="relative">
          <input
            id="current-password"
            {...form.register("currentPassword")}
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            className={inputCls + " pr-10"}
            placeholder="••••••••"
          />
          <button
            type="button"
            aria-label={showCurrent ? "Hide password" : "Show password"}
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCurrent ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </FormField>
      <FormField
        label="New Password"
        htmlFor="new-password"
        error={form.formState.errors.newPassword?.message}
        required
      >
        <div className="relative">
          <input
            id="new-password"
            {...form.register("newPassword")}
            type={showNew ? "text" : "password"}
            autoComplete="new-password"
            className={inputCls + " pr-10"}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            aria-label={showNew ? "Hide new password" : "Show new password"}
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showNew ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </FormField>
      <FormField
        label="Confirm New Password"
        htmlFor="confirm-password"
        error={form.formState.errors.confirmPassword?.message}
        required
      >
        <input
          id="confirm-password"
          {...form.register("confirmPassword")}
          type={showNew ? "text" : "password"}
          autoComplete="new-password"
          className={inputCls}
          placeholder="Repeat new password"
        />
      </FormField>
      <div className="flex justify-end pt-1 border-t">
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-3 h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          {form.formState.isSubmitting && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
