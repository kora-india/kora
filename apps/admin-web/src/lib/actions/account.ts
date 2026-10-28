"use server";

import { auth } from "@schoolos/auth";
import { changeOwnPassword } from "@schoolos/auth/password";
import { prisma } from "@schoolos/db";
import { ColorModeSchema } from "@schoolos/types";

export async function changePassword(data: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  return changeOwnPassword(session.user.id, data);
}

/** Saves light, dark or system to the signed-in person's account. */
export async function saveColorMode(
  mode: unknown,
): Promise<{ success: true; error?: never } | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = ColorModeSchema.safeParse(mode);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { colorMode: parsed.data },
  });
  return { success: true };
}
