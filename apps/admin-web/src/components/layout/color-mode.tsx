"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { ColorMode } from "@schoolos/types";
import { saveColorMode } from "@/lib/actions/account";
import { revealChange } from "@/lib/theme-reveal";

/**
 * Applies the light/dark choice saved to the person's account, so it follows
 * them to every device. Until they pick one, the browser's last choice stays.
 */
export function ColorModeSync({
  saved,
}: Readonly<{ saved: ColorMode | null }>) {
  const { setTheme } = useTheme();
  const applied = useRef<ColorMode | null>(null);

  useEffect(() => {
    if (saved && applied.current !== saved) {
      applied.current = saved;
      setTheme(saved);
    }
  }, [saved, setTheme]);

  return null;
}

/** Whether `mode` means dark on this device. */
const looksDark = (mode: ColorMode) =>
  mode === "dark" ||
  (mode === "system" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);

/** The current light/dark choice, and a way to change it and save it. */
export function useColorMode() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  /** `origin` is what was clicked; the new look grows from it. */
  const choose = useCallback(
    (mode: ColorMode, origin: Element | null = null) => {
      const root = document.documentElement;
      const dark = looksDark(mode);
      if (dark === root.classList.contains("dark")) {
        setTheme(mode);
      } else {
        revealChange(origin, () => {
          // next-themes applies the class after a render; the reveal needs
          // the new look in place before this returns.
          root.classList.toggle("dark", dark);
          root.classList.toggle("light", !dark);
          root.style.colorScheme = dark ? "dark" : "light";
          setTheme(mode);
        });
      }
      void saveColorMode(mode).then((result) => {
        if (result.error) toast.error(result.error);
      });
    },
    [setTheme],
  );

  return {
    mode: theme as ColorMode | undefined,
    isDark: resolvedTheme === "dark",
    choose,
  };
}
