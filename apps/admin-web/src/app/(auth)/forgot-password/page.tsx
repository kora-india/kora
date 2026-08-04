"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/password-reset";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    const result = await requestPasswordReset(data);
    if (result.error) { toast.error(result.error); return; }
    setSubmitted(true);
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

        {submitted ? (
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <MailCheck className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Check your email</h2>
            <p className="text-muted-foreground text-sm">
              If an account exists for that email, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
            </p>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1">Forgot your password?</h2>
              <p className="text-muted-foreground text-sm">Enter your email and we&apos;ll send you a reset link</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email address</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="admin@school.edu.in"
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                Send reset link
              </button>
            </form>

            <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
