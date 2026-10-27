import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import {
  NO_ACCESS,
  resolvePermissions,
  type Permissions,
} from "@schoolos/types";

/**
 * The signed-in teacher's permissions, as the school admin set them in the
 * admin app (packages/types/src/permissions.ts). Read on every request, so a
 * change applies at once. No access for a signed-out or deactivated login.
 */
export async function getPermissions(): Promise<Permissions> {
  const session = await auth();
  if (!session?.user) return { ...NO_ACCESS };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true, permissions: true },
  });
  if (!user?.isActive) return { ...NO_ACCESS };
  return resolvePermissions(user.role, user.permissions);
}
