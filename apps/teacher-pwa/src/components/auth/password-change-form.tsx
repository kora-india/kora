"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";

const inputCls =
  "w-full h-12 px-4 rounded-2xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * First sign-in with a temporary password. Changing it signs out older
 * sessions, so the teacher is signed straight back in with the new one.
 */
export function PasswordChangeForm({ email }: Readonly<{ email: string }>) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      toast.error(result.error || "Couldn't change your password");
      return;
    }
    const signedIn = await signIn("credentials", {
      email,
      password: form.newPassword,
      redirect: false,
    });
    if (signedIn?.error) {
      toast.success("Password changed. Sign in with your new password.");
      await signOut({ callbackUrl: "/login" });
      return;
    }
    toast.success("Password changed");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-gray-950 dark:to-gray-900 px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Choose your password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your account was set up with a temporary password. Choose your own
            to continue.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-3xl border p-6 shadow-sm space-y-4"
        >
          <div>
            <label
              htmlFor="current-password"
              className="text-xs font-medium mb-1.5 block"
            >
              Temporary password
            </label>
            <input
              id="current-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={set("currentPassword")}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="text-xs font-medium mb-1.5 block"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={set("newPassword")}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className={inputCls + " pr-12"}
              />
              <button
                type="button"
                aria-label={showPw ? "Hide passwords" : "Show passwords"}
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="text-xs font-medium mb-1.5 block"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              required
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-violet-600 text-white rounded-2xl font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save and continue"}
          </button>
        </form>
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground px-1">
          <span className="truncate">{email}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="font-medium hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
