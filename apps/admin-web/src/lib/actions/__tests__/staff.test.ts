import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { createStaff, deleteStaff, updateStaff } from "../staff";
import { updateMemberPermissions } from "../team";
import { ROLE_DEFAULT_PERMISSIONS, UserRole } from "@schoolos/types";

const suffix = Math.random().toString(36).substring(7);
const schoolId = `staff-test-${suffix}`;
const mail = (name: string) => `${name}-${suffix}@test.com`;

const signInAs = (id: string, role: string) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId, role, name: "Asha Admin" },
  } as any);

const accountant = (name: string, over = {}) => ({
  name,
  phone: "9000000000",
  occupation: "Accountant",
  email: mail(name.toLowerCase()),
  createLogin: true,
  ...over,
});

const created = async (data: unknown) => {
  const res = await createStaff(data);
  if ("error" in res) throw new Error(res.error);
  return res;
};

const staffOf = (id: string) =>
  prisma.staff.findUniqueOrThrow({ where: { id } });
const loginOf = (email: string) => prisma.user.findUnique({ where: { email } });

describe("staff and their logins", () => {
  let managerId: string;

  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Staff School",
        subdomain: schoolId,
        plan: "PRO",
      },
    });
    // An accountant the admin has let manage staff, but not logins.
    managerId = (
      await prisma.user.create({
        data: {
          email: mail("manager"),
          name: "Manager",
          password: "hash",
          role: "ACCOUNTANT",
          schoolId,
          permissions: {
            ...ROLE_DEFAULT_PERMISSIONS[UserRole.ACCOUNTANT],
            staff: "manage",
          },
        },
      })
    ).id;
  });

  beforeEach(() => signInAs("admin", "SCHOOL_ADMIN"));

  afterAll(async () => {
    await prisma.staff.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await purgeSchool(prisma, schoolId);
  });

  it("adds an accountant as one person: a staff card with a login", async () => {
    const email = `Ravi-${suffix}@Test.com`;
    const res = await created(accountant("Ravi", { email }));

    expect(res.login).toMatchObject({ reactivated: false });
    expect(res.login?.tempPassword).toMatch(/^[A-Za-z0-9]{16}$/);
    const login = await loginOf(email.toLowerCase());
    expect(login).toMatchObject({
      role: "ACCOUNTANT",
      schoolId,
      name: "Ravi",
      phone: "9000000000",
      mustChangePassword: true,
      permissions: null,
    });
    expect(await staffOf(res.id)).toMatchObject({
      userId: login?.id,
      email: email.toLowerCase(),
      occupation: "Accountant",
    });
  });

  it("reads Accountant however it's typed", async () => {
    const res = await created(
      accountant("Typed", { occupation: "  accountant " }),
    );
    expect(res.login).toBeDefined();
  });

  it("gives other staff no login, whatever is asked", async () => {
    const res = await created(accountant("Driver", { occupation: "Driver" }));
    expect(res.login).toBeUndefined();
    expect((await staffOf(res.id)).userId).toBeNull();
    expect(await loginOf(mail("driver"))).toBeNull();
  });

  it("can keep an accountant as a card with no login", async () => {
    const res = await created(accountant("Card", { createLogin: false }));
    expect(res.login).toBeUndefined();
    expect((await staffOf(res.id)).userId).toBeNull();
    expect(await loginOf(mail("card"))).toBeNull();
  });

  it("needs an email for a login", async () => {
    expect(await createStaff(accountant("NoEmail", { email: "" }))).toEqual({
      error: "Add their email so they can sign in",
    });
    expect(
      await prisma.staff.count({ where: { schoolId, name: "NoEmail" } }),
    ).toBe(0);
  });

  it("saves nothing if the email already has a login", async () => {
    expect(
      await createStaff(accountant("Clash", { email: mail("manager") })),
    ).toEqual({ error: "A user with this email already exists" });
    expect(
      await prisma.staff.count({ where: { schoolId, name: "Clash" } }),
    ).toBe(0);
  });

  it("leaves logins to admins", async () => {
    signInAs(managerId, "ACCOUNTANT");
    expect(await createStaff(accountant("Sneaky"))).toEqual({
      error: "Only a school admin can give someone a login",
    });
    expect(await loginOf(mail("sneaky"))).toBeNull();

    const card = await created(accountant("Plain", { createLogin: false }));
    expect(await updateStaff(card.id, accountant("Plain"))).toEqual({
      error: "Only a school admin can give someone a login",
    });
  });

  it("gives an existing card a login when asked, not otherwise", async () => {
    const card = await created(accountant("Later", { createLogin: false }));

    const edited = await updateStaff(
      card.id,
      accountant("Later", { createLogin: false, phone: "9111111111" }),
    );
    expect(edited).toMatchObject({ success: true });
    expect(await loginOf(mail("later"))).toBeNull();

    const res = await updateStaff(card.id, accountant("Later"));
    if ("error" in res) throw new Error(res.error);
    expect(res.login).toBeDefined();
    const login = await loginOf(mail("later"));
    expect((await staffOf(card.id)).userId).toBe(login?.id);
  });

  it("won't make a second login for someone who has one", async () => {
    const res = await created(accountant("Once"));
    const again = await updateStaff(res.id, accountant("Once"));
    expect(again).toMatchObject({ success: true, login: undefined });
  });

  it("keeps the login's name and phone in step", async () => {
    const res = await created(accountant("Meera"));
    await updateStaff(
      res.id,
      accountant("Meera Rao", {
        email: mail("meera"),
        phone: "9222222222",
      }),
    );
    expect(await loginOf(mail("meera"))).toMatchObject({
      name: "Meera Rao",
      phone: "9222222222",
    });
  });

  it("keeps someone's sign-in email and role while they have a login", async () => {
    const res = await created(accountant("Fixed"));
    await updateStaff(
      res.id,
      accountant("Fixed", { email: mail("other"), occupation: "Driver" }),
    );
    expect(await staffOf(res.id)).toMatchObject({
      email: mail("fixed"),
      occupation: "Accountant",
    });
    expect(await loginOf(mail("other"))).toBeNull();
  });

  it("ends the login when someone is removed", async () => {
    const res = await created(accountant("Going"));
    expect(await deleteStaff(res.id)).toEqual({ success: true });
    expect((await staffOf(res.id)).isActive).toBe(false);
    expect((await loginOf(mail("going")))?.isActive).toBe(false);
    const log = await prisma.activityLog.findFirst({
      where: { schoolId, action: "staff.remove" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.summary).toBe("Removed staff member Going and their login");
  });

  it("removes staff with no login as before", async () => {
    const res = await created(accountant("Plain2", { occupation: "Peon" }));
    expect(await deleteStaff(res.id)).toEqual({ success: true });
    expect((await staffOf(res.id)).isActive).toBe(false);
  });

  it("only lets an admin remove someone who signs in", async () => {
    const res = await created(accountant("Stays"));
    signInAs(managerId, "ACCOUNTANT");
    expect(await deleteStaff(res.id)).toEqual({
      error: "Only a school admin can remove someone who signs in",
    });
    expect((await staffOf(res.id)).isActive).toBe(true);
    expect((await loginOf(mail("stays")))?.isActive).toBe(true);
  });

  it("brings a removed accountant's login back on a new card", async () => {
    const first = await created(accountant("Back"));
    await deleteStaff(first.id);

    const res = await created(accountant("Back"));

    expect(res.login).toMatchObject({ reactivated: true });
    const login = await loginOf(mail("back"));
    expect(login).toMatchObject({ isActive: true, permissions: null });
    expect((await staffOf(res.id)).userId).toBe(login?.id);
    expect((await staffOf(first.id)).userId).toBeNull();
  });

  it("leaves other schools' staff alone", async () => {
    const res = await created(accountant("Mine"));
    vi.mocked(auth).mockResolvedValue({
      user: { id: "x", schoolId: "another-school", role: "SCHOOL_ADMIN" },
    } as any);
    expect(await updateStaff(res.id, accountant("Mine"))).toHaveProperty(
      "error",
    );
    expect(await deleteStaff(res.id)).toHaveProperty("error");
    signInAs("admin", "SCHOOL_ADMIN");
    expect((await staffOf(res.id)).isActive).toBe(true);
  });

  it("still sets access from Team & Access", async () => {
    await created(accountant("Access"));
    const login = await loginOf(mail("access"));
    expect(
      await updateMemberPermissions(
        login!.id,
        ROLE_DEFAULT_PERMISSIONS[UserRole.ACCOUNTANT],
      ),
    ).toMatchObject({ success: true });
  });
});
