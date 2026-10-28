import { prisma } from "@schoolos/db";
import { logger } from "@/lib/logger";
import { sendLoginDetailsEmail } from "@/lib/mailer";

/**
 * Emails a new teacher or accountant their sign-in details, and says whether
 * it went. Never throws: the login exists either way, and the admin still sees
 * the temporary password to pass on by hand.
 */
export async function emailLoginDetails(details: {
  schoolId: string;
  to: string;
  name: string;
  role: "teacher" | "accountant";
  tempPassword: string;
  reactivated: boolean;
}): Promise<boolean> {
  try {
    const school = await prisma.school.findUnique({
      where: { id: details.schoolId },
      select: { name: true },
    });
    const sent = await sendLoginDetailsEmail({
      ...details,
      schoolName: school?.name ?? "Your school",
    });
    return sent.success;
  } catch (e) {
    logger.error("Login details email failed", {
      schoolId: details.schoolId,
      error: String(e),
    });
    return false;
  }
}
