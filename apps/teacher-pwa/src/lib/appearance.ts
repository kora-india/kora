import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import {
  colorModeOf,
  themeColorOf,
  type ColorMode,
  type ThemeColor,
} from "@schoolos/types";

export interface Appearance {
  themeColor: ThemeColor;
  colorMode: ColorMode | null;
}

const DEFAULT_APPEARANCE: Appearance = {
  themeColor: themeColorOf(null),
  colorMode: null,
};

/**
 * The signed-in teacher's school color and light/dark choice, read once per
 * request. Kora's defaults when signed out, or if the lookup fails: the
 * login page must never break over a color.
 */
export const getAppearance = cache(async (): Promise<Appearance> => {
  try {
    const session = await auth();
    if (!session?.user) return DEFAULT_APPEARANCE;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { colorMode: true, school: { select: { themeColor: true } } },
    });
    return {
      themeColor: themeColorOf(user?.school?.themeColor),
      colorMode: colorModeOf(user?.colorMode),
    };
  } catch (error) {
    // Let Next.js handle its own signals, such as "render this per request".
    unstable_rethrow(error);
    return DEFAULT_APPEARANCE;
  }
});
