import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * The platform has exactly one super admin, and its login lives in the
 * environment (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD), not in code or in
 * the app. The app applies it on every start; the seed and the
 * db:super-admin script use the same code.
 */
export interface SuperAdminCredentials {
  email: string;
  password: string;
}

// Matches the app's password rule for every account.
const MIN_PASSWORD_LENGTH = 8;

export function superAdminFromEnv(
  env: Record<string, string | undefined> = process.env,
): SuperAdminCredentials {
  const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = env.SUPER_ADMIN_PASSWORD ?? "";

  const problems: string[] = [];
  if (!email) problems.push("SUPER_ADMIN_EMAIL is not set");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problems.push("SUPER_ADMIN_EMAIL is not a valid email address");
  }
  if (!password) problems.push("SUPER_ADMIN_PASSWORD is not set");
  else if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(
      `SUPER_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Can't set up the super admin: ${problems.join("; ")}. ` +
        "Add them to your .env (see .env.example).",
    );
  }
  return { email, password };
}

type Db = PrismaClient | Prisma.TransactionClient;

export interface SuperAdminPlan {
  /** True when the env account already exists as a super admin. */
  exists: boolean;
  /** The other super admins, which will be removed. */
  others: {
    id: string;
    email: string;
    notices: number;
    attendanceMarked: number;
    expenses: number;
  }[];
}

export interface SuperAdminResult {
  adminId: string;
  created: boolean;
  /** True when the stored password was replaced, which signs out sessions. */
  passwordChanged: boolean;
  /** How many other super admins were deleted. */
  removed: number;
  changed: boolean;
}

/**
 * Refuses an email that belongs to a school's user: making it the super admin
 * would pull that person out of their school.
 */
function assertNotSchoolUser(
  email: string,
  user: { role: string; school: { name: string } | null } | null,
) {
  if (user && user.role !== UserRole.SUPER_ADMIN) {
    const where = user.school ? ` at ${user.school.name}` : "";
    throw new Error(
      `${email} is already a ${user.role} account${where}. ` +
        "Use a different SUPER_ADMIN_EMAIL, or remove that account first.",
    );
  }
}

/** The env account (if any) and every other super admin, read in parallel. */
async function readSuperAdmins(db: Db, email: string) {
  const [current, others] = await Promise.all([
    db.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        password: true,
        isActive: true,
        schoolId: true,
        school: { select: { name: true } },
      },
    }),
    db.user.findMany({
      where: { role: UserRole.SUPER_ADMIN, email: { not: email } },
      select: {
        id: true,
        email: true,
        _count: {
          select: { notices: true, attendances: true, recordedExpenses: true },
        },
      },
    }),
  ]);
  assertNotSchoolUser(email, current);
  return { current, others };
}

/** What `makeSoleSuperAdmin` would change, without changing anything. */
export async function planSoleSuperAdmin(
  db: Db,
  { email }: SuperAdminCredentials,
): Promise<SuperAdminPlan> {
  const { current, others } = await readSuperAdmins(db, email);
  return {
    exists: Boolean(current),
    others: others.map((u) => ({
      id: u.id,
      email: u.email,
      notices: u._count.notices,
      attendanceMarked: u._count.attendances,
      expenses: u._count.recordedExpenses,
    })),
  };
}

/**
 * Makes the env account the platform's only super admin: creates it, updates
 * its password when the env one differs, and deletes every other super admin.
 * Their notices, attendance and expenses move to this account, since the
 * database won't delete a user those records point to.
 *
 * Safe to run on every start: when nothing differs it only reads. Reads and
 * password hashing happen before the transaction, which only writes, so it
 * stays short even on a distant database.
 */
export async function makeSoleSuperAdmin(
  prisma: PrismaClient,
  { email, password }: SuperAdminCredentials,
): Promise<SuperAdminResult> {
  const { current, others } = await readSuperAdmins(prisma, email);
  const passwordMatches = current
    ? await bcrypt.compare(password, current.password)
    : false;

  if (
    current &&
    passwordMatches &&
    current.isActive &&
    current.schoolId === null &&
    others.length === 0
  ) {
    return {
      adminId: current.id,
      created: false,
      passwordChanged: false,
      removed: 0,
      changed: false,
    };
  }

  const hash = passwordMatches ? null : await bcrypt.hash(password, 10);
  const passwordFields = hash
    ? {
        password: hash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      }
    : {};
  const ids = others.map((u) => u.id);

  return prisma.$transaction(
    async (tx) => {
      // The role filter makes this fail rather than take over an account
      // that became a school user after the read above.
      const admin = await tx.user.upsert({
        where: { email, role: UserRole.SUPER_ADMIN },
        create: {
          email,
          name: "Super Admin",
          password: hash!,
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
        update: {
          ...passwordFields,
          isActive: true,
          ...(current?.schoolId ? { school: { disconnect: true } } : {}),
        },
        select: { id: true },
      });

      if (ids.length > 0) {
        await tx.notice.updateMany({
          where: { publishedById: { in: ids } },
          data: { publishedById: admin.id },
        });
        await tx.attendance.updateMany({
          where: { markedById: { in: ids } },
          data: { markedById: admin.id },
        });
        await tx.expense.updateMany({
          where: { recordedById: { in: ids } },
          data: { recordedById: admin.id },
        });
        await tx.user.deleteMany({
          where: { id: { in: ids }, role: UserRole.SUPER_ADMIN },
        });
      }

      return {
        adminId: admin.id,
        created: !current,
        passwordChanged: Boolean(current && hash),
        removed: ids.length,
        changed: true,
      };
    },
    // As for starter data: a remote database can be slow to answer.
    { maxWait: 10_000, timeout: 30_000 },
  );
}
