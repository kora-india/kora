"use server";

import { auth } from "@schoolos/auth";
import { changeOwnPassword } from "@schoolos/auth/password";

export async function changePassword(data: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  return changeOwnPassword(session.user.id, data);
}
