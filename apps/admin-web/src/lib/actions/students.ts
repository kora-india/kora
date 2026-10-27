"use server";

import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkStudentLimit, planLimitMessage } from "@/lib/plan-limits";
import { getCache, invalidateCache, invalidateFeesCache } from "@/lib/redis";
import { recomputeChargeStatus } from "@/lib/fees/charge-status";
import { todayInTimeZone } from "@/lib/fees/timezone";
import { waiveChargeItemInTx } from "@/lib/fees/waive";
import {
  admissionSettingsFor,
  sequenceOfAdmissionNumber,
} from "@/lib/admission-number";
import {
  calculateSubjectGrade,
  calculateReportCardSummary,
} from "@/lib/grading";
import { compareRollNumbers } from "@schoolos/types";

const StudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  rollNumber: z.string().min(1, "Roll number is required"),
  admissionNumber: z.string().min(1, "Admission number is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  parentName: z.string().min(2, "Parent name is required"),
  parentPhone: z.string().min(6, "Parent phone is required"),
  parentEmail: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

import { getActiveSchoolUser } from "@/lib/auth-guard";
import { actionErrorMessage } from "@/lib/action-errors";

async function getAdminSession() {
  return getActiveSchoolUser(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
}

async function getStaffSession() {
  return getActiveSchoolUser([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "ACCOUNTANT",
    "TEACHER",
  ]);
}

/**
 * D4: roll numbers are per section, and only active students hold them, so a
 * withdrawn student's number can be reused. Returns the name of the active
 * student already using the roll number, if any.
 */
async function activeRollHolder(
  schoolId: string,
  sectionId: string,
  rollNumber: string,
  excludeStudentId?: string,
): Promise<string | null> {
  const holder = await prisma.student.findFirst({
    where: {
      schoolId,
      sectionId,
      isActive: true,
      rollNumber: { equals: rollNumber.trim(), mode: "insensitive" },
      ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
    },
    select: { name: true },
  });
  return holder?.name ?? null;
}

function duplicateStudentError(e: any, admissionNumber: string) {
  if (e?.code !== "P2002") return null;
  return `Admission number ${admissionNumber} is already used in your school`;
}

export async function searchStudents(query: string = "", limit: number = 25) {
  const user = await getStaffSession();
  if (!user) return { error: "Unauthorized" };

  const trimmed = query.trim();

  const whereClause: any = {
    schoolId: user.schoolId,
    isActive: true,
  };

  if (trimmed) {
    whereClause.OR = [
      { name: { contains: trimmed, mode: "insensitive" } },
      { rollNumber: { contains: trimmed, mode: "insensitive" } },
      { admissionNumber: { contains: trimmed, mode: "insensitive" } },
      { parentPhone: { contains: trimmed, mode: "insensitive" } },
      { parentName: { contains: trimmed, mode: "insensitive" } },
      { class: { name: { contains: trimmed, mode: "insensitive" } } },
      { section: { name: { contains: trimmed, mode: "insensitive" } } },
    ];
  }

  try {
    const students = await prisma.student.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        rollNumber: true,
        admissionNumber: true,
        parentPhone: true,
        parentName: true,
        address: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [
        { class: { name: "asc" } },
        { rollNumber: "asc" },
        { name: "asc" },
      ],
      take: Math.min(Math.max(1, limit), 50),
    });

    students.sort((a, b) => {
      const classComp = (a.class?.name || "").localeCompare(
        b.class?.name || "",
      );
      if (classComp !== 0) return classComp;
      const rollComp = compareRollNumbers(a.rollNumber, b.rollNumber);
      if (rollComp !== 0) return rollComp;
      return a.name.localeCompare(b.name);
    });

    return { success: true, students };
  } catch (err: any) {
    return { error: actionErrorMessage(err, "Failed to search students") };
  }
}

export async function createStudent(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = StudentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const limit = await checkStudentLimit(user.schoolId);
  if (!limit.allowed) {
    return {
      error: planLimitMessage(
        "students",
        limit.current,
        limit.max,
        limit.planName,
      ),
    };
  }

  const { dateOfBirth, parentEmail, ...rest } = parsed.data;

  // Validate class belongs to school
  const classObj = await prisma.class.findFirst({
    where: { id: parsed.data.classId, schoolId: user.schoolId },
  });
  if (!classObj) return { error: "Class not found in your school" };

  // Validate section belongs to school and class
  const sectionObj = await prisma.section.findFirst({
    where: {
      id: parsed.data.sectionId,
      classId: parsed.data.classId,
      schoolId: user.schoolId,
    },
  });
  if (!sectionObj) return { error: "Section not found for this class" };

  const rollHolder = await activeRollHolder(
    user.schoolId,
    parsed.data.sectionId,
    parsed.data.rollNumber,
  );
  if (rollHolder) {
    return {
      error: `Roll number ${parsed.data.rollNumber} is already used by ${rollHolder} in this section`,
    };
  }

  try {
    const student = await prisma.student.create({
      data: {
        ...rest,
        schoolId: user.schoolId,
        parentEmail: parentEmail || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });

    // D3: advance the school's admission sequence only past a number it
    // actually produced; numbers typed in by hand leave it alone.
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        admissionNumberPrefix: true,
        admissionNumberFormat: true,
        subdomain: true,
        nextAdmissionNumber: true,
      },
    });
    if (school) {
      const { prefix, format } = admissionSettingsFor(school);
      const usedSequence = sequenceOfAdmissionNumber(
        student.admissionNumber,
        format,
        prefix,
        school.nextAdmissionNumber,
      );
      if (usedSequence !== null) {
        await prisma.school.updateMany({
          where: {
            id: user.schoolId,
            nextAdmissionNumber: { lte: usedSequence },
          },
          data: { nextAdmissionNumber: usedSequence + 1 },
        });
      }
    }

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:students:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return { success: true, id: student.id };
  } catch (e: any) {
    const duplicate = duplicateStudentError(e, parsed.data.admissionNumber);
    if (duplicate) return { error: duplicate };
    return { error: actionErrorMessage(e) };
  }
}

export async function updateStudent(id: string, data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = StudentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existing = await prisma.student.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) return { error: "Student not found in your school" };

  // Validate class belongs to school
  const classObj = await prisma.class.findFirst({
    where: { id: parsed.data.classId, schoolId: user.schoolId },
  });
  if (!classObj) return { error: "Class not found in your school" };

  // Validate section belongs to school and class
  const sectionObj = await prisma.section.findFirst({
    where: {
      id: parsed.data.sectionId,
      classId: parsed.data.classId,
      schoolId: user.schoolId,
    },
  });
  if (!sectionObj) return { error: "Section not found for this class" };

  const rollHolder = await activeRollHolder(
    user.schoolId,
    parsed.data.sectionId,
    parsed.data.rollNumber,
    existing.id,
  );
  if (rollHolder) {
    return {
      error: `Roll number ${parsed.data.rollNumber} is already used by ${rollHolder} in this section`,
    };
  }

  const { dateOfBirth, parentEmail, ...rest } = parsed.data;

  try {
    const student = await prisma.student.update({
      where: { id: existing.id },
      data: {
        ...rest,
        parentEmail: parentEmail || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });
    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:students:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
    ]);
    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return { success: true, id: student.id };
  } catch (e: any) {
    const duplicate = duplicateStudentError(e, parsed.data.admissionNumber);
    if (duplicate) return { error: duplicate };
    return { error: actionErrorMessage(e) };
  }
}

/**
 * Withdraws a student (they are deactivated, never deleted) and ends their
 * transport. With `waiveOpenCharges`, everything they still owe is waived in
 * the same transaction (B16), so withdrawn students don't stay on dues lists.
 * Their roll number is freed for reuse in the section (D4/D13).
 */
export async function deleteStudent(
  id: string,
  options: { waiveOpenCharges?: boolean } = {},
) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const existing = await prisma.student.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) return { error: "Student not found in your school" };

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { timezone: true },
    });
    const today = todayInTimeZone(school?.timezone);

    const waivedCount = await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: existing.id },
        data: { isActive: false },
      });

      // D13: a withdrawn student no longer rides the bus.
      await tx.studentTransport.updateMany({
        where: { studentId: existing.id, status: "ACTIVE" },
        data: { status: "INACTIVE", endDate: new Date() },
      });

      if (!options.waiveOpenCharges) return 0;

      const openItems = await tx.feeChargeItem.findMany({
        where: {
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          charge: { studentId: existing.id, schoolId: user.schoolId },
        },
        include: { charge: true, component: true },
      });
      for (const item of openItems) {
        await waiveChargeItemInTx(
          tx,
          item,
          user.id,
          "Student withdrawn from school",
        );
      }
      for (const chargeId of new Set(openItems.map((i) => i.chargeId))) {
        await recomputeChargeStatus(tx, chargeId, today);
      }
      return openItems.length;
    });

    await Promise.all([
      invalidateCache(`cache:${user.schoolId}:students:*`),
      invalidateCache(`cache:${user.schoolId}:dashboard`),
      invalidateCache(`cache:${user.schoolId}:analytics`),
      invalidateCache(`cache:${user.schoolId}:transport:*`),
      ...(waivedCount > 0 ? [invalidateFeesCache(user.schoolId)] : []),
    ]);
    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return { success: true, waivedCount };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}

export async function getStudentDetails(id: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const student = await getCache(
      `cache:${user.schoolId}:students:details:v5:${id}`,
      async () => {
        const s = await prisma.student.findFirst({
          where: { id, schoolId: user.schoolId },
          include: {
            school: {
              select: {
                feePaymentMode: true,
                minPartialPaymentPercentage: true,
                minPartialPaymentAmount: true,
              },
            },
            class: true,
            section: true,
            feeCharges: {
              orderBy: { createdAt: "desc" },
              include: {
                items: {
                  include: {
                    component: true,
                  },
                },
              },
            },
            paymentTxs: {
              orderBy: { date: "desc" },
            },
            advanceLedgers: {
              orderBy: { createdAt: "desc" },
            },
            transports: {
              where: { status: "ACTIVE" },
              include: {
                route: true,
                stop: true,
                vehicle: true,
              },
            },
            attendances: {
              orderBy: { date: "desc" },
              take: 120,
              select: {
                id: true,
                date: true,
                status: true,
                remarks: true,
              },
            },
          },
        });

        if (!s) return null;

        // Fetch exams applicable to the student's class
        const exams = await prisma.exam.findMany({
          where: {
            schoolId: user.schoolId,
            subjects: {
              some: {
                classId: s.classId,
              },
            },
          },
          include: {
            subjects: {
              where: {
                classId: s.classId,
              },
              orderBy: { order: "asc" },
              include: {
                marks: {
                  where: { studentId: s.id },
                },
              },
            },
          },
          orderBy: { startDate: "desc" },
        });

        const processedExams = exams.map((exam) => {
          const subjectsWithMarks = exam.subjects.map((subj) => {
            const markRecord = subj.marks[0];
            const marksObtained =
              markRecord?.marksObtained !== null &&
              markRecord?.marksObtained !== undefined
                ? Number(markRecord.marksObtained)
                : null;
            const isAbsent = markRecord?.isAbsent ?? false;

            const gradeInfo = calculateSubjectGrade(
              marksObtained,
              Number(subj.maxMarks),
              Number(subj.passMarks),
              isAbsent,
              exam.gradingSystem as any,
            );

            const percentage =
              marksObtained !== null && Number(subj.maxMarks) > 0
                ? Number(
                    ((marksObtained / Number(subj.maxMarks)) * 100).toFixed(1),
                  )
                : 0;

            return {
              id: subj.id,
              subjectName: subj.subjectName,
              maxMarks: Number(subj.maxMarks),
              passMarks: Number(subj.passMarks),
              examDate: subj.examDate ? subj.examDate.toISOString() : null,
              marksObtained,
              isAbsent,
              percentage,
              grade: gradeInfo.grade,
              gradePoint: gradeInfo.gradePoint,
              remark: gradeInfo.remark,
              isPass: gradeInfo.isPass,
              remarks: markRecord?.remarks || null,
              isEvaluated:
                markRecord !== undefined &&
                (isAbsent || marksObtained !== null),
            };
          });

          const evaluatedSubjects = subjectsWithMarks.filter(
            (subj) => subj.isEvaluated,
          );
          const summary = calculateReportCardSummary(
            subjectsWithMarks.map((subj) => ({
              maxMarks: subj.maxMarks,
              passMarks: subj.passMarks,
              marksObtained: subj.marksObtained,
              isAbsent: subj.isAbsent,
            })),
            exam.gradingSystem as any,
          );

          return {
            id: exam.id,
            name: exam.name,
            type: exam.type,
            academicYear: exam.academicYear,
            gradingSystem: exam.gradingSystem,
            startDate: exam.startDate.toISOString(),
            endDate: exam.endDate.toISOString(),
            isPublished: exam.isPublished,
            hasMarks: evaluatedSubjects.length > 0,
            evaluatedCount: evaluatedSubjects.length,
            totalSubjectsCount: subjectsWithMarks.length,
            summary,
            subjects: subjectsWithMarks,
          };
        });

        const totalDays = s.attendances?.length ?? 0;
        const presentDays =
          s.attendances?.filter((a: any) => a.status === "PRESENT").length ?? 0;
        const absentDays =
          s.attendances?.filter((a: any) => a.status === "ABSENT").length ?? 0;
        const lateDays =
          s.attendances?.filter((a: any) => a.status === "LATE").length ?? 0;
        const excusedDays =
          s.attendances?.filter((a: any) => a.status === "EXCUSED").length ?? 0;
        const attendedDays = presentDays + lateDays + excusedDays;
        const attendanceRate =
          totalDays > 0
            ? Number(((attendedDays / totalDays) * 100).toFixed(1))
            : 100;

        const attendanceSummary = {
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          excusedDays,
          attendedDays,
          attendanceRate,
        };

        return {
          ...s,
          exams: processedExams,
          attendanceSummary,
        };
      },
    );

    return { success: true, student };
  } catch (e: any) {
    return { error: actionErrorMessage(e) };
  }
}
