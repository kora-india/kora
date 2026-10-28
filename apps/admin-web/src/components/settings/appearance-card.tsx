"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@schoolos/utils";
import type { ColorMode } from "@schoolos/types";
import { SettingsCard } from "@/components/settings/settings-card";
import { useColorMode } from "@/components/layout/color-mode";

const OPTIONS: { mode: ColorMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

export function AppearanceCard() {
  const { mode, choose } = useColorMode();
  // The choice lives in the browser, so the server can't render it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingsCard
      title="Appearance"
      description="Light or dark, or System to follow your device. Saved to your account, so it applies wherever you sign in."
    >
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="grid grid-cols-3 gap-2 sm:max-w-md"
      >
        {OPTIONS.map(({ mode: option, label, icon: Icon }) => {
          const isSelected = mounted && mode === option;
          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected
                  ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="appearance"
                value={option}
                checked={isSelected}
                onChange={(e) =>
                  choose(option, e.currentTarget.closest("label"))
                }
                className="sr-only"
              />
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </label>
          );
        })}
      </div>
    </SettingsCard>
  );
}
