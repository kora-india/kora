"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FormField, inputCls } from "@/components/ui/form-field";
import { changePassword } from "@/lib/actions/account";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordForm = z.infer<typeof ChangePasswordSchema>;

export function ChangePasswordContent() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const form = useForm<ChangePasswordForm>({ resolver: zodResolver(ChangePasswordSchema) });

  const onSubmit = async (data: ChangePasswordForm) => {
    const result = await changePassword(data);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Password updated");
    form.reset();
  };

  return (
    <div className="p-6 max-w-md space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Change Password</h1>
        <p className="text-muted-foreground text-sm mt-1">Update the password used to sign in to your account</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Current Password" error={form.formState.errors.currentPassword?.message} required>
            <div className="relative">
              <input {...form.register("currentPassword")} type={showCurrent ? "text" : "password"} className={inputCls + " pr-10"} placeholder="••••••••" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="New Password" error={form.formState.errors.newPassword?.message} required>
            <div className="relative">
              <input {...form.register("newPassword")} type={showNew ? "text" : "password"} className={inputCls + " pr-10"} placeholder="At least 6 characters" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="Confirm New Password" error={form.formState.errors.confirmPassword?.message} required>
            <input {...form.register("confirmPassword")} type={showNew ? "text" : "password"} className={inputCls} placeholder="Repeat new password" />
          </FormField>
          <div className="flex justify-end pt-1 border-t">
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {form.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
