import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import nodemailer from "nodemailer";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { sendLoginDetailsEmail } from "@/lib/mailer";
import { createStaff } from "../staff";
import { createTeacher } from "../teachers";

const suffix = Math.random().toString(36).substring(7);
const schoolId = `login-mail-school-${suffix}`;
const { sendMail } = nodemailer.createTransport({} as any);

const addAccountant = async (name: string, email: string) => {
  const created = await createStaff({
    name,
    email,
    phone: "9000000000",
    occupation: "Accountant",
    createLogin: true,
  });
  if ("error" in created || !created.login) throw new Error("no login");
  return created.login;
};

/** The emails sent during this test, as nodemailer received them. */
const sentMail = () =>
  vi.mocked(sendMail).mock.calls.map(([mail]) => mail as any);

describe("emailing new logins their sign-in details", () => {
  let adminId: string;

  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "St. Mary's <School>",
        subdomain: schoolId,
        plan: "PRO",
      },
    });
    adminId = (
      await prisma.user.create({
        data: {
          email: `admin-${suffix}@test.com`,
          name: "Admin",
          password: "hash",
          role: "SCHOOL_ADMIN",
          schoolId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.teacher.deleteMany({ where: { schoolId } });
    await prisma.staff.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.deleteMany({ where: { id: schoolId } });
  });

  beforeEach(() => {
    vi.mocked(sendMail).mockClear();
    vi.mocked(auth).mockResolvedValue({
      user: { id: adminId, schoolId, role: "SCHOOL_ADMIN" },
    } as any);
  });

  it("sends an accountant their email, temporary password and sign-in link", async () => {
    const email = `ravi-${suffix}@test.com`;
    const created = await addAccountant("Ravi", email);
    expect(created.emailed).toBe(true);

    const [mail] = sentMail();
    expect(mail.to).toBe(email);
    expect(mail.subject).toBe("Your Kora login for St. Mary's <School>");
    expect(mail.html).toContain(created.tempPassword);
    expect(mail.html).toContain(email);
    expect(mail.html).toContain("/login");
    expect(mail.html).toContain("as an accountant");
    expect(mail.html).toContain("choose your own password");
    // The school's name is escaped, not markup.
    expect(mail.html).toContain("St. Mary&#39;s &lt;School&gt;");
  });

  it("sends a teacher theirs too", async () => {
    const email = `meera-${suffix}@test.com`;
    const created = await createTeacher({
      name: "Meera Iyer",
      email,
      subject: "Science",
    });
    if (!created.success) throw new Error(created.error);
    expect(created.emailed).toBe(true);

    const [mail] = sentMail();
    expect(mail.to).toBe(email);
    expect(mail.html).toContain(created.tempPassword);
    expect(mail.html).toContain("as a teacher");
  });

  it("still creates the login when the email can't be sent", async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error("SMTP down"));
    const email = `asha-${suffix}@test.com`;
    const created = await addAccountant("Asha", email);

    expect(created.emailed).toBe(false);
    expect(created.tempPassword).toBeTruthy();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.mustChangePassword).toBe(true);
  });

  it("escapes a name that looks like markup", async () => {
    await sendLoginDetailsEmail({
      to: "x@test.com",
      name: '<img src=x onerror="alert(1)">',
      schoolName: "School",
      role: "teacher",
      tempPassword: "Abc-123",
    });
    const [mail] = sentMail();
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});
