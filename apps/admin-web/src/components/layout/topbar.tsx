"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  Search,
  User,
  KeyRound,
  Sparkles,
  AlertTriangle,
  Zap,
  Crown,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { cn } from "@schoolos/utils";
import type { SessionUser } from "@schoolos/types";
import type { SubscriptionEvaluation } from "@/lib/subscription";

interface TopbarProps {
  user: SessionUser;
  breadcrumb?: string;
  subscription?: SubscriptionEvaluation | null;
  schoolPlan?: string;
}

export function Topbar({
  user,
  breadcrumb,
  subscription,
  schoolPlan,
}: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const activePlan = subscription?.plan || schoolPlan;

  return (
    <header className="h-14 border-b bg-card/60 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10 print:hidden">
      {breadcrumb && (
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{breadcrumb}</span>
        </p>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Active Plan Pill */}
        {activePlan && (
          <>
            {subscription?.isTrial ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-700 dark:text-violet-300 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-pulse" />
                <span>
                  {activePlan} · Trial ({subscription.daysRemaining}d left)
                </span>
              </div>
            ) : subscription?.isPastDue ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300 shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  {activePlan} · Past Due ({subscription.daysRemaining}d grace)
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold shadow-xs transition-colors",
                  activePlan === "ENTERPRISE" &&
                    "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
                  activePlan === "PRO" &&
                    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800/60",
                  activePlan === "BASIC" &&
                    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
                  activePlan === "FREE" &&
                    "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200 dark:border-slate-700",
                )}
              >
                {activePlan === "ENTERPRISE" && (
                  <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                )}
                {activePlan === "PRO" && (
                  <Zap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 fill-violet-600/20" />
                )}
                {activePlan === "BASIC" && (
                  <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                )}
                {activePlan === "FREE" && (
                  <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                )}
                <span>{activePlan} Plan</span>
              </div>
            )}
          </>
        )}

        <button className="h-8 px-3 flex items-center gap-2 rounded-lg border text-xs text-muted-foreground hover:bg-muted transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline text-[10px] bg-muted px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>

        <button className="relative h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        <div className="relative flex items-center gap-2 pl-2 border-l">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg hover:bg-muted transition-colors px-1 py-0.5 -ml-1"
          >
            <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium leading-none">{user.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {user.email}
              </p>
            </div>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border bg-card shadow-lg py-1">
              <Link
                href="/settings/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" /> Change Password
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
