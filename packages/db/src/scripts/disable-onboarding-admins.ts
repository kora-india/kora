/**
 * S3 cleanup: disables the extra school-admin accounts that the old setup
 * wizard seed created for every school ("admin.<subdomain>@schoolos.com",
 * shared password "Admin@123"). The seed code is gone; this handles the
 * accounts that already exist.
 *
 * Accounts are deactivated, not deleted (attendance and notices reference
 * users). Deactivated users can't log in, and their open sessions are dropped
 * within two minutes by the session check in @schoolos/auth.
 *
 *   pnpm --filter @schoolos/db db:disable-onboarding-admins           # dry run
 *   pnpm --filter @schoolos/db db:disable-onboarding-admins --apply   # change data
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomBytes } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

/** The email the old seed derived from a school's subdomain. */
function seededAdminEmail(subdomain: string): string {
  return `admin.${subdomain.toLowerCase().replace(/[^a-z0-9]/g, "")}@schoolos.com`;
}

async function main() {
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, subdomain: true },
  });

  const targets: {
    id: string;
    email: string;
    isActive: boolean;
    school: string;
    notices: number;
    attendanceMarked: number;
    expenses: number;
  }[] = [];

  for (const school of schools) {
    const user = await prisma.user.findFirst({
      where: {
        email: seededAdminEmail(school.subdomain),
        schoolId: school.id,
        role: "SCHOOL_ADMIN",
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        _count: {
          select: { notices: true, attendances: true, recordedExpenses: true },
        },
      },
    });
    if (!user) continue;
    targets.push({
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      school: school.name,
      notices: user._count.notices,
      attendanceMarked: user._count.attendances,
      expenses: user._count.recordedExpenses,
    });
  }

  if (targets.length === 0) {
    console.log("No seeded onboarding admin accounts found.");
    return;
  }

  console.log(`Found ${targets.length} seeded onboarding admin account(s):`);
  console.table(targets.map(({ id: _id, ...row }) => row));
  const used = targets.filter(
    (t) => t.notices + t.attendanceMarked + t.expenses > 0,
  );
  if (used.length > 0) {
    console.log(
      `\n${used.length} of these have created records, so someone has logged in with them. ` +
        "Check with those schools before relying on the account, and review its activity.",
    );
  }

  if (!apply) {
    console.log(
      "\nDry run: nothing changed. Re-run with --apply to disable these accounts.",
    );
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: {
      isActive: false,
      // Not a bcrypt hash, so no password can ever match it.
      password: `disabled:${randomBytes(24).toString("hex")}`,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`\nDisabled ${result.count} account(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
