"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { ColorMode } from "@schoolos/types";
import { saveColorMode } from "@/lib/actions/account";

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

/** The current light/dark choice, and a way to change it and save it. */
export function useColorMode() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const choose = useCallback(
    (mode: ColorMode) => {
      setTheme(mode);
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
