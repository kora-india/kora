"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCache } from "@/lib/redis";

const UpdateSchoolProfileSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
});

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

export async function updateSchoolProfile(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = UpdateSchoolProfileSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.school.update({
      where: { id: user.schoolId },
      data: {
        name: parsed.data.name,
        address: parsed.data.address || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
      },
    });

    await invalidateCache(`cache:${user.schoolId}:school:*`);
    await invalidateCache(`cache:${user.schoolId}:dashboard`);

    revalidatePath("/settings");
    revalidatePath("/settings/school-profile");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
