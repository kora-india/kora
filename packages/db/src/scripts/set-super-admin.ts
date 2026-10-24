/**
 * Makes the account in SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD the platform's
 * only super admin: creates it (or updates its password) and deletes every
 * other super admin, moving their notices, attendance and expenses to it.
 * The app does this itself on every start; this script previews it (dry run)
 * or applies it without a restart. Safe for a live database, unlike the seed.
 *
 *   pnpm --filter @schoolos/db db:super-admin           # dry run
 *   pnpm --filter @schoolos/db db:super-admin --apply   # change data
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import {
  makeSoleSuperAdmin,
  planSoleSuperAdmin,
  superAdminFromEnv,
} from "../super-admin";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const credentials = superAdminFromEnv();
  const plan = await planSoleSuperAdmin(prisma, credentials);

  console.log(
    plan.exists
      ? `${credentials.email} is already a super admin; its password is updated if it differs.`
      : `${credentials.email} will be created as the super admin.`,
  );
  if (plan.others.length === 0) {
    console.log("There are no other super admins to remove.");
  } else {
    console.log(
      `\nThese ${plan.others.length} super admin(s) will be deleted:`,
    );
    console.table(plan.others.map(({ id: _id, ...row }) => row));
    const moving = plan.others.reduce(
      (n, o) => n + o.notices + o.attendanceMarked + o.expenses,
      0,
    );
    if (moving > 0) {
      console.log(
        `Their ${moving} notice, attendance and expense record(s) will move to ${credentials.email}.`,
      );
    }
  }

  if (!apply) {
    console.log("\nDry run: nothing changed. Re-run with --apply to do this.");
    return;
  }

  const result = await makeSoleSuperAdmin(prisma, credentials);
  console.log(
    result.changed
      ? `\nDone. ${credentials.email} is the only super admin` +
          `${result.created ? " (created)" : ""}` +
          `${result.passwordChanged ? "; password updated" : ""}` +
          `; removed ${result.removed} other account(s).`
      : `\nNothing to change: ${credentials.email} is already the only super admin.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
