import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import {
  makeSoleSuperAdmin,
  planSoleSuperAdmin,
  superAdminFromEnv,
} from "@schoolos/db/super-admin";

interface FakeUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  password: string;
  isActive: boolean;
  schoolId: string | null;
  passwordChangedAt?: Date | null;
  mustChangePassword?: boolean;
}

interface Owned {
  id: string;
  [ownerField: string]: string;
}

/**
 * The handful of Prisma calls the super admin code makes, over plain arrays.
 * `writes` counts every create, update and delete.
 */
function fakeDb(
  users: FakeUser[],
  schools: Record<string, string> = {},
  records: { notices?: Owned[]; attendance?: Owned[]; expenses?: Owned[] } = {},
) {
  const notices = records.notices ?? [];
  const attendance = records.attendance ?? [];
  const expenses = records.expenses ?? [];
  const state = {
    writes: 0,
    transactions: 0,
    readsInTransaction: 0,
    transactionOptions: undefined as unknown,
  };
  let inTransaction = false;
  const read = () => {
    if (inTransaction) state.readsInTransaction++;
  };

  const matches = (u: FakeUser, where: any) => {
    if (where.role && u.role !== where.role) return false;
    if (where.email?.not !== undefined && u.email === where.email.not)
      return false;
    if (where.id?.not !== undefined && u.id === where.id.not) return false;
    if (where.id?.in && !where.id.in.includes(u.id)) return false;
    return true;
  };
  const reassign = (rows: Owned[], field: string) => ({
    updateMany: async ({ where, data }: any) => {
      state.writes++;
      let count = 0;
      for (const row of rows) {
        if (where[field].in.includes(row[field])) {
          row[field] = data[field];
          count++;
        }
      }
      return { count };
    },
  });

  const db: any = {
    user: {
      findUnique: async ({ where }: any) => {
        read();
        const u = users.find((x) => x.email === where.email);
        return u
          ? { ...u, school: u.schoolId ? { name: schools[u.schoolId] } : null }
          : null;
      },
      findMany: async ({ where }: any) => {
        read();
        return users
          .filter((u) => matches(u, where))
          .map((u) => ({
            ...u,
            _count: {
              notices: notices.filter((n) => n.publishedById === u.id).length,
              attendances: attendance.filter((a) => a.markedById === u.id)
                .length,
              recordedExpenses: expenses.filter((e) => e.recordedById === u.id)
                .length,
            },
          }));
      },
      // Like Prisma: a `where` that matches nothing creates, so a role filter
      // on someone else's email hits the unique email.
      upsert: async ({ where, create, update }: any) => {
        state.writes++;
        const user = users.find((u) => u.email === where.email);
        if (user && where.role && user.role !== where.role) {
          throw new Error("Unique constraint failed on the fields: (`email`)");
        }
        if (!user) return db.user.create({ data: create });
        state.writes--;
        return db.user.update({ where: { id: user.id }, data: update });
      },
      create: async ({ data }: any) => {
        state.writes++;
        const user = {
          id: `user-${users.length + 1}`,
          schoolId: null,
          passwordChangedAt: null,
          mustChangePassword: false,
          ...data,
        };
        users.push(user);
        return user;
      },
      update: async ({ where, data }: any) => {
        state.writes++;
        const user = users.find((u) => u.id === where.id)!;
        const { school, ...rest } = data;
        Object.assign(user, rest);
        if (school?.disconnect) user.schoolId = null;
        return user;
      },
      deleteMany: async ({ where }: any) => {
        state.writes++;
        const before = users.length;
        for (let i = users.length - 1; i >= 0; i--) {
          if (where.id.in.includes(users[i].id)) users.splice(i, 1);
        }
        return { count: before - users.length };
      },
    },
    notice: reassign(notices, "publishedById"),
    attendance: reassign(attendance, "markedById"),
    expense: reassign(expenses, "recordedById"),
    $transaction: async (
      fn: (tx: any) => Promise<unknown>,
      options?: unknown,
    ) => {
      state.transactions++;
      state.transactionOptions = options;
      inTransaction = true;
      try {
        return await fn(db);
      } finally {
        inTransaction = false;
      }
    },
  };
  return { db, users, state, notices, attendance, expenses };
}

const OWNER = { email: "owner@kora.in", password: "Owner-pass-2026" };

const superAdmin = async (
  id: string,
  email: string,
  password: string,
  extra: Partial<FakeUser> = {},
): Promise<FakeUser> => ({
  id,
  email,
  role: "SUPER_ADMIN",
  password: await bcrypt.hash(password, 4),
  isActive: true,
  schoolId: null,
  passwordChangedAt: null,
  ...extra,
});

describe("superAdminFromEnv", () => {
  it("reads and normalises the email", () => {
    expect(
      superAdminFromEnv({
        SUPER_ADMIN_EMAIL: "  Owner@Kora.IN ",
        SUPER_ADMIN_PASSWORD: "Owner-pass-2026",
      }),
    ).toEqual(OWNER);
  });

  it("says everything that's wrong at once", () => {
    expect(() =>
      superAdminFromEnv({
        SUPER_ADMIN_EMAIL: "owner",
        SUPER_ADMIN_PASSWORD: "short",
      }),
    ).toThrow(
      "SUPER_ADMIN_EMAIL is not a valid email address; SUPER_ADMIN_PASSWORD must be at least 8 characters",
    );
    expect(() => superAdminFromEnv({})).toThrow(
      "SUPER_ADMIN_EMAIL is not set; SUPER_ADMIN_PASSWORD is not set",
    );
  });
});

describe("makeSoleSuperAdmin", () => {
  it("creates the env account and deletes the old super admin", async () => {
    const { db, users } = fakeDb([
      await superAdmin("old", "superadmin@schoolos.com", "superadmin123"),
    ]);

    const result = await makeSoleSuperAdmin(db, OWNER);

    expect(result).toMatchObject({ created: true, removed: 1, changed: true });
    expect(users.map((u) => [u.email, u.role])).toEqual([
      ["owner@kora.in", "SUPER_ADMIN"],
    ]);
    expect(await bcrypt.compare(OWNER.password, users[0].password)).toBe(true);
  });

  it("moves the old super admin's records instead of losing them", async () => {
    const { db, notices, attendance, expenses } = fakeDb(
      [await superAdmin("old", "superadmin@schoolos.com", "superadmin123")],
      {},
      {
        notices: [{ id: "n1", publishedById: "old" }],
        attendance: [{ id: "a1", markedById: "old" }],
        expenses: [{ id: "e1", recordedById: "old" }],
      },
    );

    const { adminId } = await makeSoleSuperAdmin(db, OWNER);

    expect(notices[0].publishedById).toBe(adminId);
    expect(attendance[0].markedById).toBe(adminId);
    expect(expenses[0].recordedById).toBe(adminId);
  });

  it("keeps the transaction to writes, with room for a slow database", async () => {
    const { db, state } = fakeDb([
      await superAdmin("old", "superadmin@schoolos.com", "superadmin123"),
    ]);

    await makeSoleSuperAdmin(db, OWNER);

    // A remote database takes ~1s a query: reads and hashing in the
    // transaction once pushed it past Prisma's 5s limit.
    expect(state.readsInTransaction).toBe(0);
    expect(state.transactionOptions).toEqual({
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

  it("only reads when everything already matches, so sessions survive restarts", async () => {
    const changedAt = new Date("2026-10-01");
    const { db, state, users } = fakeDb([
      await superAdmin("owner", OWNER.email, OWNER.password, {
        passwordChangedAt: changedAt,
      }),
    ]);

    const result = await makeSoleSuperAdmin(db, OWNER);

    expect(result).toEqual({
      adminId: "owner",
      created: false,
      passwordChanged: false,
      removed: 0,
      changed: false,
    });
    expect(state).toMatchObject({ writes: 0, transactions: 0 });
    expect(users[0].passwordChangedAt).toBe(changedAt);
  });

  it("updates the password when the env one changes, signing out old sessions", async () => {
    const { db, users } = fakeDb([
      await superAdmin("owner", OWNER.email, "Old-pass-2025", {
        mustChangePassword: true,
      }),
    ]);

    const result = await makeSoleSuperAdmin(db, OWNER);

    expect(result).toMatchObject({
      passwordChanged: true,
      created: false,
      removed: 0,
    });
    expect(await bcrypt.compare(OWNER.password, users[0].password)).toBe(true);
    expect(users[0].passwordChangedAt).toBeInstanceOf(Date);
    expect(users[0].mustChangePassword).toBe(false);
  });

  it("keeps the password and its sessions when only another super admin is removed", async () => {
    const { db, users } = fakeDb([
      await superAdmin("owner", OWNER.email, OWNER.password),
      await superAdmin("extra", "extra@kora.in", "Extra-pass-1"),
    ]);

    const result = await makeSoleSuperAdmin(db, OWNER);

    expect(result).toMatchObject({
      passwordChanged: false,
      removed: 1,
      changed: true,
    });
    expect(users.map((u) => u.id)).toEqual(["owner"]);
    expect(users[0].passwordChangedAt).toBeNull();
  });

  it("switches to a new email from env, removing the previous super admin", async () => {
    const { db, users } = fakeDb([
      await superAdmin("owner", OWNER.email, OWNER.password),
    ]);

    await makeSoleSuperAdmin(db, {
      email: "new-owner@kora.in",
      password: "New-pass-2027",
    });

    expect(users.map((u) => u.email)).toEqual(["new-owner@kora.in"]);
  });

  it("reactivates the env account if it was disabled", async () => {
    const { db, users } = fakeDb([
      await superAdmin("owner", OWNER.email, OWNER.password, {
        isActive: false,
      }),
    ]);

    const result = await makeSoleSuperAdmin(db, OWNER);

    expect(result.changed).toBe(true);
    expect(users[0].isActive).toBe(true);
  });

  it("refuses an email a school user logs in with, and changes nothing", async () => {
    const { db, users, state } = fakeDb(
      [
        await superAdmin("old", "superadmin@schoolos.com", "superadmin123"),
        {
          id: "school-admin",
          email: OWNER.email,
          role: "SCHOOL_ADMIN",
          password: await bcrypt.hash("Admin-pass-1", 4),
          isActive: true,
          schoolId: "dmps",
        },
      ],
      { dmps: "Dayawati Modi Public School" },
    );

    await expect(makeSoleSuperAdmin(db, OWNER)).rejects.toThrow(
      "owner@kora.in is already a SCHOOL_ADMIN account at Dayawati Modi Public School",
    );
    expect(state.writes).toBe(0);
    expect(users.map((u) => u.id)).toEqual(["old", "school-admin"]);
  });
});

describe("makeSoleSuperAdmin race", () => {
  it("won't take over an account that became a school user after the read", async () => {
    const schoolAdmin = {
      id: "school-admin",
      email: OWNER.email,
      role: "SCHOOL_ADMIN",
      password: await bcrypt.hash("Admin-pass-1", 4),
      isActive: true,
      schoolId: "dmps",
    };
    const { db, users } = fakeDb([schoolAdmin], { dmps: "DMPS" });
    // The read sees no account; it is created before the write.
    const findUnique = db.user.findUnique;
    db.user.findUnique = async (args: any) =>
      args.where.email === OWNER.email ? null : findUnique(args);

    await expect(makeSoleSuperAdmin(db, OWNER)).rejects.toThrow(
      /Unique constraint/,
    );
    expect(users).toEqual([schoolAdmin]);
    expect(users[0]).toMatchObject({ role: "SCHOOL_ADMIN", schoolId: "dmps" });
  });
});

describe("planSoleSuperAdmin", () => {
  it("lists who would be removed and their records, without writing", async () => {
    const { db, state } = fakeDb(
      [await superAdmin("old", "superadmin@schoolos.com", "superadmin123")],
      {},
      { notices: [{ id: "n1", publishedById: "old" }] },
    );

    const plan = await planSoleSuperAdmin(db, OWNER);

    expect(plan).toEqual({
      exists: false,
      others: [
        {
          id: "old",
          email: "superadmin@schoolos.com",
          notices: 1,
          attendanceMarked: 0,
          expenses: 0,
        },
      ],
    });
    expect(state.writes).toBe(0);
  });
});
