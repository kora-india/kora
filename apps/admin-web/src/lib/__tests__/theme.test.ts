import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BRAND_SHADES,
  DEFAULT_THEME_COLOR,
  THEME_COLORS,
  THEME_COLOR_KEYS,
  brandHex,
  brandStyleSheet,
  colorModeOf,
  themeColorOf,
} from "@schoolos/types";

/** WCAG contrast ratio between two "r g b" colors. */
function contrast(a: string, b: string) {
  const luminance = (rgb: string) => {
    const [r, g, bl] = rgb.split(" ").map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = "255 255 255";
const ZINC_950 = "9 9 11";

describe("theme colors", () => {
  it.each(THEME_COLOR_KEYS)(
    "%s keeps text readable where the app puts it",
    (key) => {
      const p = THEME_COLORS[key].palette;
      for (const shade of BRAND_SHADES) {
        expect(p[shade]).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      }
      // White text on buttons (bg-violet-600 text-white).
      expect(contrast(p[600], WHITE)).toBeGreaterThanOrEqual(4.5);
      // Links and badges (text-violet-600/700 on white or violet-50).
      expect(contrast(p[600], p[50])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p[700], p[50])).toBeGreaterThanOrEqual(4.5);
      // Dark mode text (dark:text-violet-400).
      expect(contrast(p[400], ZINC_950)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("defaults to the purple both apps' style sheets already set", () => {
    const purple = THEME_COLORS[DEFAULT_THEME_COLOR].palette;
    for (const app of ["admin-web", "teacher-pwa"]) {
      const css = readFileSync(
        path.resolve(__dirname, `../../../../${app}/src/app/globals.css`),
        "utf8",
      );
      for (const shade of BRAND_SHADES) {
        expect(css, `${app} --brand-${shade}`).toContain(
          `--brand-${shade}: ${purple[shade]};`,
        );
      }
    }
    expect(brandHex(DEFAULT_THEME_COLOR)).toBe("#7c3aed");
    expect(brandStyleSheet(DEFAULT_THEME_COLOR)).toBe("");
  });

  it("writes every shade of another color into one style sheet", () => {
    const css = brandStyleSheet("green");
    expect(css.startsWith("html:root{")).toBe(true);
    for (const shade of BRAND_SHADES) {
      expect(css).toContain(
        `--brand-${shade}:${THEME_COLORS.green.palette[shade]};`,
      );
    }
  });

  it("falls back to the defaults for missing or unknown values", () => {
    expect(themeColorOf(null)).toBe("purple");
    expect(themeColorOf("chartreuse")).toBe("purple");
    expect(themeColorOf("toString")).toBe("purple");
    expect(themeColorOf("teal")).toBe("teal");
    expect(colorModeOf(undefined)).toBeNull();
    expect(colorModeOf("sepia")).toBeNull();
    expect(colorModeOf("system")).toBe("system");
  });
});
