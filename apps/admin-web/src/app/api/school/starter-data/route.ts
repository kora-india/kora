import { NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { createLogger } from "@schoolos/logger";
import { z } from "zod";
import { seedStarterData } from "@/lib/onboarding";
import { logActivity } from "@/lib/activity";

const logger = createLogger("school-starter-data");

const Schema = z.object({
  classes: z.array(z.string().min(1).max(40)).max(40).optional(),
  academicSession: z.string().max(20).optional(),
});

/**
 * Adds a new school's starter session, classes and fee setup when that failed
 * during setup (U6). Only for a school that has no academic session yet, so
 * running it twice cannot duplicate anything.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      school: { select: { id: true, name: true, subdomain: true } },
    },
  });
  if (user?.role !== "SCHOOL_ADMIN" || !user.school) {
    return NextResponse.json(
      { error: "Only a school's admin can do this" },
      { status: 403 },
    );
  }

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const school = user.school;
  if (await prisma.academicSession.count({ where: { schoolId: school.id } })) {
    return NextResponse.json(
      { error: "Your school already has an academic session." },
      { status: 400 },
    );
  }

  try {
    await seedStarterData(prisma, {
      schoolId: school.id,
      subdomain: school.subdomain,
      schoolName: school.name,
      classes: parsed.data.classes,
      academicSession: parsed.data.academicSession,
    });
    await logActivity(
      { ...session.user, role: user.role },
      {
        schoolId: school.id,
        action: "school.starter_data",
        module: "settings",
        summary: "Added the starter classes, academic session and fee setup",
      },
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, schoolId: school.id }, "Starter data retry failed");
    return NextResponse.json(
      {
        error:
          "We still couldn't add them. Add your classes from the Classes page and your session from Settings.",
      },
      { status: 500 },
    );
  }
}
