"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

/** First sign-in with a temporary password: choose your own to continue. */
export function ForcedPasswordChange({ email }: Readonly<{ email: string }>) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <Image
            src="/kora-icon.png"
            alt="Kora"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="text-sm font-bold tracking-tight">Kora</span>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">
            Choose your own password
          </h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Your account was set up with a temporary password. Choose a new one
            to continue.
          </p>
          <ChangePasswordForm
            currentLabel="Temporary Password"
            submitLabel="Save and continue"
            onChanged={() => {
              // A full load, so every page reads the new session.
              window.location.href = "/dashboard";
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span className="truncate">{email}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
