import { prisma } from "@schoolos/db";
import {
  makeSoleSuperAdmin,
  superAdminFromEnv,
} from "@schoolos/db/super-admin";
import { createLogger } from "@schoolos/logger";

type Env = Record<string, string | undefined>;

/**
 * Applies SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD when the server starts, so
 * changing them and restarting is all it takes. Never throws: a bad setting
 * is logged and the existing super admin is left as it is.
 */
export async function syncSuperAdminFromEnv(env: Env = process.env) {
  const logger = createLogger("super-admin");
  if (!env.SUPER_ADMIN_EMAIL?.trim() && !env.SUPER_ADMIN_PASSWORD) return;

  try {
    const credentials = superAdminFromEnv(env);
    const result = await makeSoleSuperAdmin(prisma, credentials);
    if (result.changed) {
      logger.info(
        {
          email: credentials.email,
          created: result.created,
          passwordChanged: result.passwordChanged,
          removedOtherSuperAdmins: result.removed,
        },
        "Super admin updated from the environment",
      );
    }
    return result;
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : error },
      "Couldn't update the super admin from the environment; it was left as it was",
    );
  }
}
