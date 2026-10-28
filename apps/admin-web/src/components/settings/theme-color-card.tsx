"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
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
      title="Theme Color"
      description="Buttons, links and highlights use this color for everyone at your school, in Kora and in the teacher app."
    >
      <div
        role="radiogroup"
        aria-label="Theme color"
        className="grid grid-cols-4 gap-2 sm:grid-cols-8"
      >
        {THEME_COLOR_KEYS.map((color) => {
          const isSelected = color === selected;
          return (
            <label
              key={color}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected ? "text-foreground" : "text-muted-foreground",
                saving && "cursor-wait",
              )}
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
              <span
                aria-hidden
                data-swatch
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background transition-[box-shadow,transform] duration-300",
                  isSelected && "scale-110 ring-2",
                )}
                style={
                  {
                    backgroundColor: brandHex(color),
                    "--tw-ring-color": brandHex(color),
                  } as React.CSSProperties
                }
              >
                {saving === color ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  isSelected && <Check className="h-4 w-4" />
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
