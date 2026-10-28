"use client";

import { createContext, useContext } from "react";
import { ConfigProvider } from "antd";
import {
  DEFAULT_THEME_COLOR,
  brandHex,
  type BrandShade,
  type ThemeColor,
} from "@schoolos/types";

const BrandContext = createContext<ThemeColor>(DEFAULT_THEME_COLOR);

/**
 * The school's theme color inside the dashboard. Tailwind classes get it from
 * the --brand-* variables the layout sets; this covers what needs a plain
 * color instead, such as antd's components.
 */
export function BrandProvider({
  color,
  children,
}: Readonly<{ color: ThemeColor; children: React.ReactNode }>) {
  return (
    <BrandContext.Provider value={color}>
      <ConfigProvider theme={{ token: { colorPrimary: brandHex(color) } }}>
        {children}
      </ConfigProvider>
    </BrandContext.Provider>
  );
}

/** A shade of the school's color as "#rrggbb"; Kora's purple outside a school. */
export function useBrandHex(shade: BrandShade = 600) {
  return brandHex(useContext(BrandContext), shade);
}
