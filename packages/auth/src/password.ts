import bcrypt from "bcryptjs";
import { prisma } from "@schoolos/db";
import { ChangePasswordSchema } from "@schoolos/types";

export type ChangePasswordResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

const SUPER_ADMIN_PASSWORD_ERROR =
  "The super admin's password is set with SUPER_ADMIN_PASSWORD on the server. Change it there and restart the app.";

/**
 * Changes the signed-in user's own password, for the admin app and the
 * teacher app alike. It clears "must change password", and the new
 * passwordChangedAt signs out every older session, so callers sign the user
 * in again with the new password.
 */
export async function changeOwnPassword(
  userId: string,
  data: unknown,
): Promise<ChangePasswordResult> {
  const parsed = ChangePasswordSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isActive) return { error: "User not found" };
  // Set by SUPER_ADMIN_PASSWORD; a change here would be undone on restart.
  if (user.role === "SUPER_ADMIN") return { error: SUPER_ADMIN_PASSWORD_ERROR };

  const isValid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.password,
  );
  if (!isValid) return { error: "Current password is incorrect" };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(parsed.data.newPassword, 10),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });
  return { success: true };
}
