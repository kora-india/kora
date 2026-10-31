import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@schoolos/db";
import { UserRole } from "@schoolos/types";
import { logActivity } from "@/lib/activity";
import { logger } from "@/lib/logger";
import { emailLoginDetails } from "@/lib/login-details";
import { generateTempPassword } from "@/lib/temp-password";

const EMAIL_TAKEN = "A user with this email already exists";

/** What the admin is shown once, after giving someone a login. */
export interface AccountantLogin {
  tempPassword: string;
  emailed: boolean;
  reactivated: boolean;
}

/**
 * Gives an accountant a login with the accountant defaults and a temporary
 * password, emailed to them and shown once. `link` saves their staff record
 * with it, in one transaction, so there's never a login without a person. An
 * accountant removed earlier with the same email gets their login back.
 */
export async function addAccountantLogin<T>(
  admin: Parameters<typeof logActivity>[0] & { schoolId: string },
  details: { name: string; email: string; phone: string },
  link: (tx: Prisma.TransactionClient, userId: string) => Promise<T>,
): Promise<{ linked: T; login: AccountantLogin } | { error: string }> {
  const { name, email, phone } = details;
  const { schoolId } = admin;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, schoolId: true, role: true },
  });
  const rehire =
    existing &&
    !existing.isActive &&
    existing.schoolId === schoolId &&
    existing.role === UserRole.ACCOUNTANT;
  if (existing && !rehire) return { error: EMAIL_TAKEN };

  const tempPassword = generateTempPassword();
  const account = {
    name,
    phone,
    password: await bcrypt.hash(tempPassword, 10),
    mustChangePassword: true,
  };

  let saved: { userId: string; linked: T };
  try {
    saved = await prisma.$transaction(async (tx) => {
      const user = rehire
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              ...account,
              isActive: true,
              passwordChangedAt: new Date(),
              permissions: Prisma.DbNull,
            },
          })
        : await tx.user.create({
            data: { ...account, email, role: UserRole.ACCOUNTANT, schoolId },
          });
      // Their old staff record stays as history, without the login.
      if (rehire) {
        await tx.staff.updateMany({
          where: { userId: user.id },
          data: { userId: null },
        });
      }
      return { userId: user.id, linked: await link(tx, user.id) };
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: EMAIL_TAKEN };
    throw e;
  }

  logger.info(
    rehire ? "Accountant login restored" : "Accountant login created",
    { schoolId, userId: saved.userId, by: admin.id },
  );
  revalidatePath("/settings/team");
  await logActivity(admin, {
    action: rehire ? "team.accountant_restore" : "team.accountant_create",
    module: "settings",
    summary: `${rehire ? "Restored the" : "Created an"} accountant login for ${name} (${email})`,
    entityType: "User",
    entityId: saved.userId,
  });

  const emailed = await emailLoginDetails({
    schoolId,
    to: email,
    name,
    role: "accountant",
    tempPassword,
    reactivated: Boolean(rehire),
  });
  return {
    linked: saved.linked,
    login: { tempPassword, emailed, reactivated: Boolean(rehire) },
  };
}
