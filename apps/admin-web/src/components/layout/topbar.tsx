"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Sun, Moon, LogOut, Search, User, KeyRound } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import type { SessionUser } from "@schoolos/types";

interface TopbarProps {
  user: SessionUser;
  breadcrumb?: string;
}

export function Topbar({ user, breadcrumb }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-14 border-b bg-card/60 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10">
      {breadcrumb && (
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{breadcrumb}</span>
        </p>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button className="h-8 px-3 flex items-center gap-2 rounded-lg border text-xs text-muted-foreground hover:bg-muted transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        <button className="relative h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
              <p className="text-[10px] text-muted-foreground mt-0.5">{user.email}</p>
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
