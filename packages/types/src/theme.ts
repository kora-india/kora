import { z } from "zod";

/**
 * School theme colors. The school admin picks one in Settings → School
 * Profile and everyone at the school sees it; Kora's purple is the default.
 *
 * Both apps point Tailwind's `violet` scale at the --brand-* variables
 * (tailwind.config), so every violet class follows the school's color.
 * Each shade is stored as "r g b", the form those variables take.
 */

export const BRAND_SHADES = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

export type BrandShade = (typeof BRAND_SHADES)[number];

interface ThemeColorDefinition {
  label: string;
  palette: Record<BrandShade, string>;
}

export const THEME_COLORS = {
  purple: {
    label: "Purple",
    // Tailwind violet.
    palette: {
      50: "245 243 255",
      100: "237 233 254",
      200: "221 214 254",
      300: "196 181 253",
      400: "167 139 250",
      500: "139 92 246",
      600: "124 58 237",
      700: "109 40 217",
      800: "91 33 182",
      900: "76 29 149",
      950: "46 16 101",
    },
  },
  indigo: {
    label: "Indigo",
    // Tailwind indigo.
    palette: {
      50: "238 242 255",
      100: "224 231 255",
      200: "199 210 254",
      300: "165 180 252",
      400: "129 140 248",
      500: "99 102 241",
      600: "79 70 229",
      700: "67 56 202",
      800: "55 48 163",
      900: "49 46 129",
      950: "30 27 75",
    },
  },
  blue: {
    label: "Blue",
    // Tailwind blue.
    palette: {
      50: "239 246 255",
      100: "219 234 254",
      200: "191 219 254",
      300: "147 197 253",
      400: "96 165 250",
      500: "59 130 246",
      600: "37 99 235",
      700: "29 78 216",
      800: "30 64 175",
      900: "30 58 138",
      950: "23 37 84",
    },
  },
  teal: {
    label: "Teal",
    // Tailwind teal, one shade darker from 500 so white text on 600 stays readable.
    palette: {
      50: "240 253 250",
      100: "204 251 241",
      200: "153 246 228",
      300: "94 234 212",
      400: "45 212 191",
      500: "13 148 136",
      600: "15 118 110",
      700: "17 94 89",
      800: "19 78 74",
      900: "4 47 46",
      950: "4 47 46",
    },
  },
  green: {
    label: "Green",
    // Tailwind emerald, one shade darker from 500 so white text on 600 stays readable.
    palette: {
      50: "236 253 245",
      100: "209 250 229",
      200: "167 243 208",
      300: "110 231 183",
      400: "52 211 153",
      500: "5 150 105",
      600: "4 120 87",
      700: "6 95 70",
      800: "6 78 59",
      900: "2 44 34",
      950: "2 44 34",
    },
  },
  maroon: {
    label: "Maroon",
    // Tailwind rose, two shades darker from 500, so it reads as maroon and
    // never looks like the red of delete buttons and errors.
    palette: {
      50: "255 241 242",
      100: "255 228 230",
      200: "254 205 211",
      300: "253 164 175",
      400: "251 113 133",
      500: "190 18 60",
      600: "159 18 57",
      700: "136 19 55",
      800: "76 5 25",
      900: "76 5 25",
      950: "76 5 25",
    },
  },
  orange: {
    label: "Orange",
    // Tailwind orange, one shade darker from 500 so white text on 600 stays readable.
    palette: {
      50: "255 247 237",
      100: "255 237 213",
      200: "254 215 170",
      300: "253 186 116",
      400: "251 146 60",
      500: "234 88 12",
      600: "194 65 12",
      700: "154 52 18",
      800: "124 45 18",
      900: "67 20 7",
      950: "67 20 7",
    },
  },
  pink: {
    label: "Pink",
    // Tailwind pink, one shade darker from 500 so white text on 600 stays readable.
    palette: {
      50: "253 242 248",
      100: "252 231 243",
      200: "251 207 232",
      300: "249 168 212",
      400: "244 114 182",
      500: "219 39 119",
      600: "190 24 93",
      700: "157 23 77",
      800: "131 24 67",
      900: "80 7 36",
      950: "80 7 36",
    },
  },
} satisfies Record<string, ThemeColorDefinition>;

export type ThemeColor = keyof typeof THEME_COLORS;

export const THEME_COLOR_KEYS = Object.keys(THEME_COLORS) as ThemeColor[];

export const DEFAULT_THEME_COLOR: ThemeColor = "purple";

export const ThemeColorSchema = z.enum(
  THEME_COLOR_KEYS as [ThemeColor, ...ThemeColor[]],
  { errorMap: () => ({ message: "Choose one of the theme colors" }) },
);

export function isThemeColor(value: unknown): value is ThemeColor {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(THEME_COLORS, value)
  );
}

/** The saved color, or Kora's purple when none (or an unknown one) is saved. */
export function themeColorOf(value: string | null | undefined): ThemeColor {
  return isThemeColor(value) ? value : DEFAULT_THEME_COLOR;
}

/** A shade as "#rrggbb", for libraries that need a plain color (antd, charts). */
export function brandHex(color: ThemeColor, shade: BrandShade = 600): string {
  return (
    "#" +
    THEME_COLORS[color].palette[shade]
      .split(" ")
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * A style sheet that applies `color` to the page, or "" for the default,
 * which the apps' global CSS already sets.
 */
export function brandStyleSheet(color: ThemeColor): string {
  if (color === DEFAULT_THEME_COLOR) return "";
  const palette = THEME_COLORS[color].palette;
  const variables = BRAND_SHADES.map(
    (shade) => `--brand-${shade}:${palette[shade]};`,
  ).join("");
  // html:root outranks the global :root rule wherever this sheet loads.
  return `html:root{${variables}}`;
}

/** Light or dark, or whatever the device uses. Each person picks their own. */
export const COLOR_MODES = ["light", "dark", "system"] as const;

export type ColorMode = (typeof COLOR_MODES)[number];

export const ColorModeSchema = z.enum(COLOR_MODES, {
  errorMap: () => ({ message: "Choose light, dark or system" }),
});

/** The saved light/dark choice, or null when there is none (or it's unknown). */
export function colorModeOf(
  value: string | null | undefined,
): ColorMode | null {
  return (COLOR_MODES as readonly string[]).includes(value ?? "")
    ? (value as ColorMode)
    : null;
}
