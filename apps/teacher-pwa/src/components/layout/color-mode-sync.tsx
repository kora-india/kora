"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { ColorMode } from "@schoolos/types";

/**
 * Applies the light/dark choice the teacher saved in Kora's settings, so the
 * phone app matches. Until they pick one, the phone's last choice stays.
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
