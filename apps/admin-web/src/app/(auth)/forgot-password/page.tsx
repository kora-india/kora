"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Image from "next/image";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/password-reset";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

/** How long to wait before another link can be sent. */
const RESEND_COOLDOWN_MS = 60 * 1000;
const COOLDOWN_KEY = "kora_password_reset_cooldown_until";

/** When the wait ends, kept for this tab so a reload doesn't skip it. */
function savedCooldown() {
  try {
    return Number(sessionStorage.getItem(COOLDOWN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Seconds left until `until`, ticking down once a second. */
function useSecondsLeft(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [resending, setResending] = useState(false);
  const secondsLeft = useSecondsLeft(cooldownUntil);

  useEffect(() => {
    setCooldownUntil(savedCooldown());
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  /** Asks for a link and starts the wait; false if it was refused. */
  const send = async (email: string) => {
    const result = await requestPasswordReset({ email });
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    const until = Date.now() + RESEND_COOLDOWN_MS;
    setCooldownUntil(until);
    try {
      sessionStorage.setItem(COOLDOWN_KEY, String(until));
    } catch {
      // Private mode: the wait still applies until the page reloads.
    }
    setSentTo(email.trim());
    return true;
  };

  const onSubmit = async (data: ForgotPasswordInput) => {
    await send(data.email);
  };

  const resend = async () => {
    if (!sentTo) return;
    setResending(true);
    const sent = await send(sentTo);
    setResending(false);
    if (sent) toast.success("Another link is on its way");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <Image
            src="/kora-icon.png"
            alt="Kora"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <span className="font-bold text-lg">Kora</span>
        </div>

        {sentTo ? (
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <MailCheck className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Check your email</h2>
            <p className="text-muted-foreground text-sm">
              If a Kora account uses{" "}
              <span className="font-medium text-foreground">{sentTo}</span>,
              we&apos;ve sent it a link to reset the password. The link expires
              in 1 hour. It can take a minute to arrive, so check your spam
              folder too.
            </p>
            <button
              type="button"
              onClick={resend}
              disabled={secondsLeft > 0 || resending}
              className="w-full h-10 border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:hover:bg-transparent inline-flex items-center justify-center gap-2"
            >
              {resending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {secondsLeft > 0
                ? `Resend link in ${secondsLeft}s`
                : "Resend link"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-violet-600 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1">Forgot your password?</h2>
              <p className="text-muted-foreground text-sm">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium mb-1.5 block"
                >
                  Email address
                </label>
                <input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder="admin@school.edu.in"
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || secondsLeft > 0}
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {secondsLeft > 0
                  ? `Send another link in ${secondsLeft}s`
                  : "Send reset link"}
              </button>
            </form>

            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
