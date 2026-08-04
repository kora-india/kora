"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, Eye, EyeOff } from "lucide-react";
import { resetPassword } from "@/lib/actions/password-reset";

const ResetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export function ResetPasswordContent({ token }: Readonly<{ token: string }>) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    const result = await resetPassword({ token, ...data });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Password reset. Please sign in with your new password.");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">SchoolOS</span>
        </div>

        {!token ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Invalid reset link</h2>
            <p className="text-muted-foreground text-sm">
              This password reset link is missing its token. Please request a new one.
            </p>
            <Link href="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Request a new link
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1">Set a new password</h2>
              <p className="text-muted-foreground text-sm">Choose a new password for your account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    {...register("newPassword")}
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    className="w-full h-10 px-3 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-xs text-destructive mt-1">{errors.newPassword.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Confirm Password</label>
                <input
                  {...register("confirmPassword")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat new password"
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
                {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                Reset password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
