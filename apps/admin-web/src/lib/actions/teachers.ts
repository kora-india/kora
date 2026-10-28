"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import type { Prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { checkTeacherLimit, planLimitMessage } from "@/lib/plan-limits";
import { invalidateCache, invalidateTeachersCache } from "@/lib/redis";

const TeacherSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  subject: z.string().min(1, "Subject is required"),
  qualification: z.string().optional().nullable(),
  // U13: an empty field is "not set" (null); 0 is a real salary of 0.
  salary: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().min(0).nullable(),
  ),
  joiningDate: z.string().optional().nullable(),
  assignedClassId: z.string().optional().nullable(),
  assignedSectionId: z.string().optional().nullable(),
  assignedSectionIds: z.array(z.string()).optional().default([]),
});

import { generateTempPassword } from "@/lib/temp-password";
import { emailLoginDetails } from "@/lib/login-details";
import { isError, requirePermission } from "@/lib/auth-guard";
import { actionErrorMessage } from "@/lib/action-errors";

async function getAdminSession() {
  const access = await requirePermission("staff", "manage");
  return isError(access) ? null : access;
}

export async function createTeacher(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = TeacherSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const limit = await checkTeacherLimit(user.schoolId);
  if (!limit.allowed) {
    return {
      error: planLimitMessage(
        "teachers",
        limit.current,
        limit.max,
        limit.planName,
      ),
    };
  }

  const {
    assignedClassId,
    assignedSectionId,
    assignedSectionIds,
    salary,
    joiningDate,
    ...rest
  } = parsed.data;

  // D13: a removed teacher keeps their login email. Adding them again at the
  // same school reactivates that account instead of failing on the email.
  const existingUser = await prisma.user.findUnique({
    where: { email: rest.email },
    include: { teacher: { select: { id: true, schoolId: true } } },
  });
  const rehire =
    existingUser &&
    !existingUser.isActive &&
    existingUser.schoolId === user.schoolId &&
    existingUser.teacher?.schoolId === user.schoolId
      ? { userId: existingUser.id, teacherId: existingUser.teacher.id }
      : null;
  if (existingUser && !rehire) {
    return { error: "A user with this email already exists" };
  }

  try {
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const accountData = {
          name: rest.name,
          password: hashedPassword,
          role: "TEACHER" as const,
          phone: rest.phone || null,
          mustChangePassword: true,
        };
        const teacherUser = rehire
          ? await tx.user.update({
              where: { id: rehire.userId },
              data: {
                ...accountData,
                isActive: true,
                passwordChangedAt: new Date(),
              },
            })
          : await tx.user.create({
              data: {
                ...accountData,
                email: rest.email,
                schoolId: user.schoolId,
              },
            });

        // Resolve sections
        const sectionRecords =
          assignedSectionIds && assignedSectionIds.length > 0
            ? await tx.section.findMany({
                where: {
                  id: { in: assignedSectionIds },
                  schoolId: user.schoolId,
                },
                select: { id: true, classId: true },
              })
            : [];

        const primaryClassId =
          sectionRecords[0]?.classId || assignedClassId || null;
        const primarySectionId =
          sectionRecords[0]?.id || assignedSectionId || null;

        const teacherData = {
          ...rest,
          phone: rest.phone || null,
          qualification: rest.qualification || null,
          salary: salary ?? null,
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          assignedClassId: primaryClassId,
          assignedSectionId: primarySectionId,
        };
        const teacher = rehire
          ? await tx.teacher.update({
              where: { id: rehire.teacherId },
              data: { ...teacherData, isActive: true },
            })
          : await tx.teacher.create({
              data: {
                ...teacherData,
                schoolId: user.schoolId,
                userId: teacherUser.id,
              },
            });
        if (rehire) {
          await tx.teacherSection.deleteMany({
            where: { teacherId: teacher.id },
          });
        }

        if (sectionRecords.length > 0) {
          await tx.teacherSection.createMany({
            data: sectionRecords.map((s) => ({
              schoolId: user.schoolId,
              teacherId: teacher.id,
              classId: s.classId,
              sectionId: s.id,
            })),
            skipDuplicates: true,
          });
        }

        return teacher;
      },
    );

    await invalidateTeachersCache(user.schoolId);
    revalidatePath("/teachers");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");

    const emailed = await emailLoginDetails({
      schoolId: user.schoolId,
      to: rest.email,
      name: rest.name,
      role: "teacher",
      tempPassword,
      reactivated: Boolean(rehire),
    });
    return {
      success: true,
      id: result.id,
      tempPassword,
      emailed,
      reactivated: Boolean(rehire),
    };
  } catch (e: any) {
    if (e.code === "P2002")
      return { error: "A user with this email already exists" };
    return { error: actionErrorMessage(e) };
  }
}

export async function updateTeacher(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = TeacherSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const {
    assignedClassId,
    assignedSectionId,
    assignedSectionIds,
    salary,
    joiningDate,
    ...rest
  } = parsed.data;

  // U4: a clear message when the new email belongs to another account.
  const current = await prisma.teacher.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { userId: true },
  });
  if (!current) return { error: "Teacher not found" };
  const emailOwner = await prisma.user.findFirst({
    where: {
      email: { equals: rest.email, mode: "insensitive" },
      id: { not: current.userId },
    },
    select: { id: true },
  });
  if (emailOwner) {
    return { error: "Another account already uses this email address" };
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const teacher = await tx.teacher.findFirst({
        where: { id, schoolId: user.schoolId },
      });
      if (!teacher) throw new Error("Teacher not found");

      await tx.user.update({
        where: { id: teacher.userId },
        data: { name: rest.name, email: rest.email, phone: rest.phone || null },
      });

      // Resolve sections
      const sectionRecords =
        assignedSectionIds && assignedSectionIds.length > 0
          ? await tx.section.findMany({
              where: {
                id: { in: assignedSectionIds },
                schoolId: user.schoolId,
              },
              select: { id: true, classId: true },
            })
          : [];

      const primaryClassId =
        sectionRecords[0]?.classId || assignedClassId || null;
      const primarySectionId =
        sectionRecords[0]?.id || assignedSectionId || null;

      await tx.teacher.update({
        where: { id },
        data: {
          ...rest,
          phone: rest.phone || null,
          qualification: rest.qualification || null,
          salary: salary ?? null,
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          assignedClassId: primaryClassId,
          assignedSectionId: primarySectionId,
        },
      });

      // Replace TeacherSection rows
      await tx.teacherSection.deleteMany({
        where: { teacherId: id, schoolId: user.schoolId },
      });

      if (sectionRecords.length > 0) {
        await tx.teacherSection.createMany({
          data: sectionRecords.map((s) => ({
            schoolId: user.schoolId,
            teacherId: id,
            classId: s.classId,
            sectionId: s.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    await Promise.all([
      invalidateTeachersCache(user.schoolId),
      invalidateCache(`cache:${user.schoolId}:classes:*`),
    ]);
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${id}`);
    revalidatePath("/attendance");
    return { success: true };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

export async function deleteTeacher(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!teacher) return { error: "Teacher not found" };

    // D13: a removed teacher stops being anyone's class teacher, stops
    // holding section assignments, and frees their timetable periods.
    // Salary slips and other history stay with the (inactive) record.
    const [, , classTeacher, slots] = await prisma.$transaction([
      prisma.teacher.update({
        where: { id },
        data: {
          isActive: false,
          assignedClassId: null,
          assignedSectionId: null,
        },
      }),
      prisma.user.update({
        where: { id: teacher.userId },
        data: { isActive: false },
      }),
      prisma.class.updateMany({
        where: { classTeacherId: id, schoolId: user.schoolId },
        data: { classTeacherId: null },
      }),
      prisma.timetableSlot.updateMany({
        where: { teacherId: id, schoolId: user.schoolId },
        data: { teacherId: null },
      }),
      prisma.teacherSection.deleteMany({ where: { teacherId: id } }),
    ]);

    await Promise.all([
      invalidateTeachersCache(user.schoolId),
      invalidateCache(`cache:${user.schoolId}:classes:*`),
    ]);
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/classes");
    revalidatePath("/timetable");
    return {
      success: true,
      releasedClasses: classTeacher.count,
      releasedPeriods: slots.count,
    };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
