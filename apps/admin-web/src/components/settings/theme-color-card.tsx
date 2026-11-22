"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@schoolos/utils";
import {
  BRAND_SHADES,
  THEME_COLORS,
  THEME_COLOR_KEYS,
  brandHex,
  type ThemeColor,
} from "@schoolos/types";
import { SettingsCard } from "@/components/settings/settings-card";
import { updateSchoolThemeColor } from "@/lib/actions/settings";
import { revealChange } from "@/lib/theme-reveal";

/**
 * Shows `color` on this page at once, ahead of the layout's style sheet;
 * null hands the page back to the style sheet.
 */
function previewThemeColor(color: ThemeColor | null) {
  const style = document.documentElement.style;
  for (const shade of BRAND_SHADES) {
    if (color) {
      style.setProperty(`--brand-${shade}`, THEME_COLORS[color].palette[shade]);
    } else {
      style.removeProperty(`--brand-${shade}`);
    }
  }
}

export function ThemeColorCard({ current }: Readonly<{ current: ThemeColor }>) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState<ThemeColor | null>(null);

  useEffect(() => () => previewThemeColor(null), []);

  const choose = async (color: ThemeColor, swatch: Element | null) => {
    if (color === selected || saving) return;
    const previous = selected;
    setSaving(color);
    revealChange(swatch, () => {
      // Rendered now, so the new look already shows this swatch picked.
      flushSync(() => setSelected(color));
      previewThemeColor(color);
    });

    const result = await updateSchoolThemeColor(color);
    setSaving(null);
    if (result.error) {
      setSelected(previous);
      previewThemeColor(null);
      toast.error(result.error);
      return;
    }
    toast.success(`Theme color changed to ${THEME_COLORS[color].label}`);
    router.refresh();
  };

  return (
    <SettingsCard
      icon={Palette}
      title="Theme Color"
      description="Choose a theme color for your school portal and the teacher app."
    >
      <div
        role="radiogroup"
        aria-label="Theme color"
        className="grid grid-cols-4 gap-3 2xl:grid-cols-5"
      >
        {THEME_COLOR_KEYS.map((color) => {
          const isSelected = color === selected;
          const hex = brandHex(color);
          return (
            <label
              key={color}
              className={cn(
                "relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border bg-background px-1 py-3.5 text-xs sm:text-sm font-medium transition-colors hover:bg-muted/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected ? "text-foreground" : "text-muted-foreground",
                saving && "cursor-wait",
              )}
              style={
                isSelected
                  ? { borderColor: hex, backgroundColor: `${hex}14` }
                  : undefined
              }
            >
              <input
                type="radio"
                name="theme-color"
                value={color}
                checked={isSelected}
                onChange={(e) =>
                  choose(
                    color,
                    e.currentTarget
                      .closest("label")
                      ?.querySelector("[data-swatch]") ?? null,
                  )
                }
                disabled={saving !== null}
                className="sr-only"
              />
              {isSelected && saving !== color && (
                <span
                  aria-hidden
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-card"
                  style={{ backgroundColor: hex }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span
                aria-hidden
                data-swatch
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: hex }}
              >
                {saving === color && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </span>
              {THEME_COLORS[color].label}
            </label>
          );
        })}
      </div>
    </SettingsCard>
  );
}
