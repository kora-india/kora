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
async function assertEmailFree(db: Db, email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: { role: true, school: { select: { name: true } } },
  });
  if (user && user.role !== UserRole.SUPER_ADMIN) {
    const where = user.school ? ` at ${user.school.name}` : "";
    throw new Error(
      `${email} is already a ${user.role} account${where}. ` +
        "Use a different SUPER_ADMIN_EMAIL, or remove that account first.",
    );
  }
  return Boolean(user);
}

/** What `makeSoleSuperAdmin` would change, without changing anything. */
export async function planSoleSuperAdmin(
  db: Db,
  { email }: SuperAdminCredentials,
): Promise<SuperAdminPlan> {
  const exists = await assertEmailFree(db, email);
  const others = await db.user.findMany({
    where: { role: UserRole.SUPER_ADMIN, email: { not: email } },
    select: {
      id: true,
      email: true,
      _count: {
        select: { notices: true, attendances: true, recordedExpenses: true },
      },
    },
  });
  return {
    exists,
    others: others.map((u) => ({
      id: u.id,
      email: u.email,
      notices: u._count.notices,
      attendanceMarked: u._count.attendances,
      expenses: u._count.recordedExpenses,
    })),
  };
}

const ADMIN_FIELDS = {
  id: true,
  role: true,
  password: true,
  isActive: true,
  schoolId: true,
} as const;

/**
 * Makes the env account the platform's only super admin: creates it, updates
 * its password when the env one differs, and deletes every other super admin.
 * Their notices, attendance and expenses move to this account, since the
 * database won't delete a user those records point to.
 *
 * Safe to run on every start: when nothing differs it only reads.
 */
export async function makeSoleSuperAdmin(
  prisma: PrismaClient,
  { email, password }: SuperAdminCredentials,
): Promise<SuperAdminResult> {
  const [current, otherCount] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: ADMIN_FIELDS }),
    prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, email: { not: email } },
    }),
  ]);
  if (
    current?.role === UserRole.SUPER_ADMIN &&
    current.isActive &&
    current.schoolId === null &&
    otherCount === 0 &&
    (await bcrypt.compare(password, current.password))
  ) {
    return {
      adminId: current.id,
      created: false,
      passwordChanged: false,
      removed: 0,
      changed: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    await assertEmailFree(tx, email);
    const existing = await tx.user.findUnique({
      where: { email },
      select: ADMIN_FIELDS,
    });

    let adminId: string;
    let passwordChanged = false;
    if (!existing) {
      const admin = await tx.user.create({
        data: {
          email,
          name: "Super Admin",
          password: await bcrypt.hash(password, 10),
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
      });
      adminId = admin.id;
    } else {
      adminId = existing.id;
      passwordChanged = !(await bcrypt.compare(password, existing.password));
      const data: Prisma.UserUpdateInput = {};
      if (passwordChanged) {
        data.password = await bcrypt.hash(password, 10);
        data.passwordChangedAt = new Date();
        data.mustChangePassword = false;
      }
      if (!existing.isActive) data.isActive = true;
      if (existing.schoolId !== null) data.school = { disconnect: true };
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id: adminId }, data });
      }
    }

    const others = await tx.user.findMany({
      where: { role: UserRole.SUPER_ADMIN, id: { not: adminId } },
      select: { id: true },
    });
    const ids = others.map((u) => u.id);
    if (ids.length > 0) {
      await tx.notice.updateMany({
        where: { publishedById: { in: ids } },
        data: { publishedById: adminId },
      });
      await tx.attendance.updateMany({
        where: { markedById: { in: ids } },
        data: { markedById: adminId },
      });
      await tx.expense.updateMany({
        where: { recordedById: { in: ids } },
        data: { recordedById: adminId },
      });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    }

    return {
      adminId,
      created: !existing,
      passwordChanged,
      removed: ids.length,
      changed: true,
    };
  });
}
