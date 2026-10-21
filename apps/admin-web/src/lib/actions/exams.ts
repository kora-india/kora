"use server";

import { z } from "zod";
import { prisma, ExamType, GradingSystem } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { revalidatePath } from "next/cache";
import { calculateReportCardSummary, calculateSubjectGrade } from "../grading";
import { invalidateStudentsCache } from "@/lib/redis";
import { compareRollNumbers } from "@schoolos/types";
import { toActionResult } from "@/lib/action-errors";

const examSchema = z.object({
  name: z.string().min(1, "Exam name is required"),
  type: z.nativeEnum(ExamType).default(ExamType.TERM_1),
  academicYear: z.string().min(1, "Academic year is required"),
  gradingSystem: z
    .nativeEnum(GradingSystem)
    .default(GradingSystem.CBSE_9_POINT),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
});

async function requireExamAccess(
  allowedRoles?: ("SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "ACCOUNTANT")[],
) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  const user = session.user;
  const schoolId = user.schoolId as string;

  if (allowedRoles && !allowedRoles.includes(user.role as any)) {
    throw new Error("Forbidden: You do not have permission for this action");
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      isActive: true,
      plan: true,
      subscription: { select: { plan: true, status: true } },
    },
  });
  if (!school) throw new Error("School not found");
  if (!school.isActive) throw new Error("Your school account is suspended");

  if (user.role !== "SUPER_ADMIN") {
    const { hasFeatureAccess } = await import("@/lib/subscription");
    const allowed = hasFeatureAccess(
      school.plan,
      school.subscription?.status || "ACTIVE",
      "EXAMS",
    );
    if (!allowed) {
      throw new Error(
        "Examinations feature is not included in your subscription plan",
      );
    }
  }

  return { session, user: { ...user, schoolId } };
}

export async function getExams(academicYear?: string) {
  const { user } = await requireExamAccess();

  const where: any = { schoolId: user.schoolId };
  if (academicYear) {
    where.academicYear = academicYear;
  }

  const exams = await prisma.exam.findMany({
    where,
    include: {
      subjects: {
        include: {
          class: { select: { id: true, name: true, grade: true } },
          _count: { select: { marks: true } },
        },
        orderBy: [
          { class: { grade: "asc" } },
          { order: "asc" },
          { subjectName: "asc" },
        ],
      },
    },
    orderBy: { startDate: "desc" },
  });

  return exams;
}

export async function getExamById(examId: string) {
  const { user } = await requireExamAccess();

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId: user.schoolId },
    include: {
      subjects: {
        include: {
          class: { select: { id: true, name: true, grade: true } },
        },
        orderBy: [{ class: { grade: "asc" } }, { order: "asc" }],
      },
    },
  });

  if (!exam) {
    throw new Error("Exam not found");
  }

  return exam;
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function createExam(...args: Parameters<typeof createExamImpl>) {
  return toActionResult(() => createExamImpl(...args));
}

async function createExamImpl(data: {
  name: string;
  type?: ExamType;
  academicYear: string;
  gradingSystem?: GradingSystem;
  startDate: string | Date;
  endDate: string | Date;
  subjects?: {
    classId: string;
    subjectName: string;
    maxMarks?: number;
    passMarks?: number;
    examDate?: string | Date;
  }[];
}) {
  const { user } = await requireExamAccess(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const schoolId = user.schoolId;

  const validated = examSchema.parse(data);

  if (data.subjects && data.subjects.length > 0) {
    const classIds = Array.from(new Set(data.subjects.map((s) => s.classId)));
    const matchingClasses = await prisma.class.findMany({
      where: { id: { in: classIds }, schoolId },
      select: { id: true },
    });
    if (matchingClasses.length !== classIds.length) {
      throw new Error("One or more classes not found in your school");
    }
  }

  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        schoolId,
        name: validated.name,
        type: validated.type,
        academicYear: validated.academicYear,
        gradingSystem: validated.gradingSystem,
        startDate: new Date(validated.startDate),
        endDate: new Date(validated.endDate),
      },
    });

    if (data.subjects && data.subjects.length > 0) {
      await tx.examSubject.createMany({
        data: data.subjects.map((s, idx) => ({
          examId: created.id,
          classId: s.classId,
          subjectName: s.subjectName.trim(),
          maxMarks: s.maxMarks ?? 100,
          passMarks: s.passMarks ?? 33,
          examDate: s.examDate ? new Date(s.examDate) : null,
          order: idx,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  revalidatePath("/exams");
  return exam;
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function updateExam(...args: Parameters<typeof updateExamImpl>) {
  return toActionResult(() => updateExamImpl(...args));
}

async function updateExamImpl(
  examId: string,
  data: {
    name?: string;
    type?: ExamType;
    academicYear?: string;
    gradingSystem?: GradingSystem;
    startDate?: string | Date;
    endDate?: string | Date;
    isPublished?: boolean;
  },
) {
  const { user } = await requireExamAccess(["SUPER_ADMIN", "SCHOOL_ADMIN"]);

  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.type) updateData.type = data.type;
  if (data.academicYear) updateData.academicYear = data.academicYear;
  if (data.gradingSystem) updateData.gradingSystem = data.gradingSystem;
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

  const exam = await prisma.exam.update({
    where: { id: examId, schoolId: user.schoolId },
    data: updateData,
  });

  revalidatePath("/exams");
  return exam;
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function deleteExam(...args: Parameters<typeof deleteExamImpl>) {
  return toActionResult(() => deleteExamImpl(...args));
}

async function deleteExamImpl(examId: string) {
  const { user } = await requireExamAccess(["SUPER_ADMIN", "SCHOOL_ADMIN"]);

  await prisma.exam.delete({
    where: { id: examId, schoolId: user.schoolId },
  });

  revalidatePath("/exams");
  return { success: true };
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function togglePublishExam(
  ...args: Parameters<typeof togglePublishExamImpl>
) {
  return toActionResult(() => togglePublishExamImpl(...args));
}

async function togglePublishExamImpl(examId: string) {
  const { user } = await requireExamAccess(["SUPER_ADMIN", "SCHOOL_ADMIN"]);

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId: user.schoolId },
    select: { id: true, isPublished: true },
  });

  if (!exam) throw new Error("Exam not found");

  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { isPublished: !exam.isPublished },
  });

  revalidatePath("/exams");
  return updated;
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function addExamSubject(
  ...args: Parameters<typeof addExamSubjectImpl>
) {
  return toActionResult(() => addExamSubjectImpl(...args));
}

async function addExamSubjectImpl(data: {
  examId: string;
  classId: string;
  subjectName: string;
  maxMarks?: number;
  passMarks?: number;
  examDate?: string | Date;
}) {
  const { user } = await requireExamAccess(["SUPER_ADMIN", "SCHOOL_ADMIN"]);

  // Ensure exam belongs to school
  const exam = await prisma.exam.findFirst({
    where: { id: data.examId, schoolId: user.schoolId },
  });
  if (!exam) throw new Error("Exam not found");

  // Ensure class belongs to school
  const classObj = await prisma.class.findFirst({
    where: { id: data.classId, schoolId: user.schoolId },
  });
  if (!classObj) throw new Error("Class not found in your school");

  const subject = await prisma.examSubject.upsert({
    where: {
      examId_classId_subjectName: {
        examId: data.examId,
        classId: data.classId,
        subjectName: data.subjectName.trim(),
      },
    },
    update: {
      maxMarks: data.maxMarks ?? 100,
      passMarks: data.passMarks ?? 33,
      examDate: data.examDate ? new Date(data.examDate) : null,
    },
    create: {
      examId: data.examId,
      classId: data.classId,
      subjectName: data.subjectName.trim(),
      maxMarks: data.maxMarks ?? 100,
      passMarks: data.passMarks ?? 33,
      examDate: data.examDate ? new Date(data.examDate) : null,
    },
  });

  revalidatePath("/exams");
  return subject;
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function deleteExamSubject(
  ...args: Parameters<typeof deleteExamSubjectImpl>
) {
  return toActionResult(() => deleteExamSubjectImpl(...args));
}

async function deleteExamSubjectImpl(examSubjectId: string) {
  const { user } = await requireExamAccess(["SUPER_ADMIN", "SCHOOL_ADMIN"]);

  // Check ownership through exam
  const examSubject = await prisma.examSubject.findFirst({
    where: {
      id: examSubjectId,
      exam: { schoolId: user.schoolId },
    },
  });

  if (!examSubject) throw new Error("Exam subject not found");

  await prisma.examSubject.delete({
    where: { id: examSubjectId },
  });

  revalidatePath("/exams");
  return { success: true };
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function getExamMarksSheet(
  ...args: Parameters<typeof getExamMarksSheetImpl>
) {
  return toActionResult(() => getExamMarksSheetImpl(...args));
}

async function getExamMarksSheetImpl(
  examSubjectId: string,
  sectionId?: string,
) {
  const { user } = await requireExamAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "TEACHER",
  ]);

  const examSubject = await prisma.examSubject.findFirst({
    where: {
      id: examSubjectId,
      exam: { schoolId: user.schoolId },
    },
    include: {
      exam: true,
      class: {
        include: {
          sections: { orderBy: { name: "asc" } },
        },
      },
    },
  });

  if (!examSubject) throw new Error("Exam subject not found");

  const studentWhere: any = {
    schoolId: user.schoolId,
    classId: examSubject.classId,
    isActive: true,
  };

  if (sectionId && sectionId !== "all") {
    studentWhere.sectionId = sectionId;
  }

  const [students, existingMarks] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        name: true,
        rollNumber: true,
        admissionNumber: true,
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }],
    }),
    prisma.examMark.findMany({
      where: { examSubjectId },
      select: {
        id: true,
        studentId: true,
        marksObtained: true,
        isAbsent: true,
        remarks: true,
      },
    }),
  ]);

  students.sort((a, b) => {
    const secComp = (a.section?.name ?? "").localeCompare(
      b.section?.name ?? "",
    );
    if (secComp !== 0) return secComp;
    return compareRollNumbers(a.rollNumber, b.rollNumber);
  });

  const marksMap = new Map(existingMarks.map((m) => [m.studentId, m]));

  const marksheet = students.map((student) => {
    const markRecord = marksMap.get(student.id);
    const marksObtained =
      markRecord?.marksObtained !== null &&
      markRecord?.marksObtained !== undefined
        ? Number(markRecord.marksObtained)
        : null;
    const isAbsent = markRecord?.isAbsent ?? false;

    const gradeInfo = calculateSubjectGrade(
      marksObtained,
      Number(examSubject.maxMarks),
      Number(examSubject.passMarks),
      isAbsent,
      examSubject.exam.gradingSystem as any,
    );

    return {
      studentId: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      sectionName: student.section.name,
      marksObtained,
      isAbsent,
      remarks: markRecord?.remarks ?? "",
      grade: gradeInfo.grade,
      gradePoint: gradeInfo.gradePoint,
      isPass: gradeInfo.isPass,
    };
  });

  return {
    examSubject: {
      id: examSubject.id,
      subjectName: examSubject.subjectName,
      maxMarks: Number(examSubject.maxMarks),
      passMarks: Number(examSubject.passMarks),
      examDate: examSubject.examDate,
      className: examSubject.class.name,
      sections: examSubject.class.sections,
      examName: examSubject.exam.name,
      gradingSystem: examSubject.exam.gradingSystem,
      isPublished: examSubject.exam.isPublished,
    },
    students: marksheet,
    // Sent back with saves, so a save can't silently overwrite marks someone
    // else entered after this sheet was loaded (D11).
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Saves marks for one exam subject. Only send the rows that changed.
 *
 * D11: invalid marks are rejected instead of being turned into 0 or the
 * maximum, marks can't change once results are published, and with `since`
 * (the sheet's `loadedAt`) the save is refused if someone else changed any of
 * these students' marks after the sheet was loaded.
 */
/** U4: returns { data } or { error }; see lib/action-result. */
export async function saveBatchMarks(
  ...args: Parameters<typeof saveBatchMarksImpl>
) {
  return toActionResult(() => saveBatchMarksImpl(...args));
}

async function saveBatchMarksImpl(
  examSubjectId: string,
  entries: {
    studentId: string;
    marksObtained?: number | null;
    isAbsent?: boolean;
    remarks?: string;
  }[],
  options: { since?: string } = {},
): Promise<
  | { success: true; savedCount: number }
  | {
      success: false;
      error: string;
      invalidStudentIds?: string[];
      conflictStudentIds?: string[];
    }
> {
  const { user } = await requireExamAccess([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "TEACHER",
  ]);

  const examSubject = await prisma.examSubject.findFirst({
    where: {
      id: examSubjectId,
      exam: { schoolId: user.schoolId },
    },
    select: {
      id: true,
      maxMarks: true,
      classId: true,
      subjectName: true,
      exam: { select: { isPublished: true } },
    },
  });

  if (!examSubject) throw new Error("Exam subject not found");
  if (examSubject.exam.isPublished) {
    return {
      success: false,
      error:
        "Results for this exam are published. Unpublish the exam to change marks.",
    };
  }

  // A1: Allow teachers to enter marks only for subjects and sections they teach
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId: user.schoolId },
      include: {
        assignedSections: true,
        classTeacherOf: { select: { id: true } },
      },
    });
    if (!teacher) throw new Error("Teacher record not found");

    const isClassTeacher = teacher.classTeacherOf.some(
      (c) => c.id === examSubject.classId,
    );
    const isDirectClass = teacher.assignedClassId === examSubject.classId;
    const isSectionAssigned = teacher.assignedSections.some(
      (as) => as.classId === examSubject.classId,
    );
    const isSubjectMatch =
      teacher.subject.trim().toLowerCase() ===
      examSubject.subjectName.trim().toLowerCase();

    const hasSlot = await prisma.timetableSlot.findFirst({
      where: {
        schoolId: user.schoolId,
        teacherId: teacher.id,
        classId: examSubject.classId,
        subjectName: { equals: examSubject.subjectName, mode: "insensitive" },
      },
    });

    if (
      !hasSlot &&
      !isClassTeacher &&
      !(isSubjectMatch && (isDirectClass || isSectionAssigned))
    ) {
      throw new Error(
        "You can only enter marks for subjects and classes you teach",
      );
    }
  }

  if (entries.length > 0) {
    const studentIds = Array.from(new Set(entries.map((e) => e.studentId)));
    const matchingStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId: user.schoolId,
        classId: examSubject.classId,
      },
      select: { id: true },
    });
    if (matchingStudents.length !== studentIds.length) {
      throw new Error(
        "One or more students do not belong to this school and class",
      );
    }
  }

  const maxMarks = Number(examSubject.maxMarks);

  const invalidStudentIds: string[] = [];
  const cleanEntries = entries.map((e) => {
    let marks: number | null = null;
    if (
      !e.isAbsent &&
      e.marksObtained !== null &&
      e.marksObtained !== undefined
    ) {
      const value = Number(e.marksObtained);
      const twoDecimals = Math.round(value * 100) === value * 100;
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > maxMarks ||
        !twoDecimals
      ) {
        invalidStudentIds.push(e.studentId);
      } else {
        marks = value;
      }
    }
    return {
      studentId: e.studentId,
      marksObtained: marks,
      isAbsent: Boolean(e.isAbsent),
      remarks: e.remarks?.trim() || null,
    };
  });

  if (invalidStudentIds.length > 0) {
    return {
      success: false,
      error: `${invalidStudentIds.length} mark(s) are not valid. Marks must be between 0 and ${maxMarks}, with at most 2 decimals.`,
      invalidStudentIds,
    };
  }

  if (options.since) {
    const since = new Date(options.since);
    if (!isNaN(since.getTime())) {
      const changed = await prisma.examMark.findMany({
        where: {
          examSubjectId,
          studentId: { in: cleanEntries.map((e) => e.studentId) },
          updatedAt: { gt: since },
        },
        select: { studentId: true, student: { select: { name: true } } },
      });
      if (changed.length > 0) {
        return {
          success: false,
          error: `Someone else changed marks for ${changed
            .map((c) => c.student.name)
            .join(
              ", ",
            )} after you opened this sheet. Reload to see their changes before saving.`,
          conflictStudentIds: changed.map((c) => c.studentId),
        };
      }
    }
  }

  // Upsert all marks in a transaction
  await prisma.$transaction(
    cleanEntries.map((entry) =>
      prisma.examMark.upsert({
        where: {
          examSubjectId_studentId: {
            examSubjectId,
            studentId: entry.studentId,
          },
        },
        update: {
          marksObtained: entry.marksObtained,
          isAbsent: entry.isAbsent,
          remarks: entry.remarks,
        },
        create: {
          examSubjectId,
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          isAbsent: entry.isAbsent,
          remarks: entry.remarks,
        },
      }),
    ),
  );

  await invalidateStudentsCache(user.schoolId);
  revalidatePath("/exams");
  return { success: true, savedCount: cleanEntries.length };
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function getStudentReportCard(
  ...args: Parameters<typeof getStudentReportCardImpl>
) {
  return toActionResult(() => getStudentReportCardImpl(...args));
}

async function getStudentReportCardImpl(examId: string, studentId: string) {
  const { user } = await requireExamAccess();
  const schoolId = user.schoolId;

  const [school, exam, student] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        logoUrl: true,
      },
    }),
    prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: {
        subjects: {
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        class: true,
        section: true,
      },
    }),
  ]);

  if (!exam) throw new Error("Exam not found");
  if (!student) throw new Error("Student not found");

  // Filter subjects applicable to the student's class
  const classSubjects = exam.subjects.filter(
    (s) => s.classId === student.classId,
  );

  // Fetch marks for these subjects
  const subjectIds = classSubjects.map((s) => s.id);
  const marks = await prisma.examMark.findMany({
    where: {
      examSubjectId: { in: subjectIds },
      studentId,
    },
  });

  const marksMap = new Map(marks.map((m) => [m.examSubjectId, m]));

  const subjectsWithMarks = classSubjects.map((subject) => {
    const markRecord = marksMap.get(subject.id);
    const marksObtained =
      markRecord?.marksObtained !== null &&
      markRecord?.marksObtained !== undefined
        ? Number(markRecord.marksObtained)
        : null;
    const isAbsent = markRecord?.isAbsent ?? false;

    const gradeInfo = calculateSubjectGrade(
      marksObtained,
      Number(subject.maxMarks),
      Number(subject.passMarks),
      isAbsent,
      exam.gradingSystem as any,
    );

    const percentage =
      marksObtained !== null && Number(subject.maxMarks) > 0
        ? Number(((marksObtained / Number(subject.maxMarks)) * 100).toFixed(1))
        : 0;

    return {
      subjectId: subject.id,
      subjectName: subject.subjectName,
      maxMarks: Number(subject.maxMarks),
      passMarks: Number(subject.passMarks),
      marksObtained,
      isAbsent,
      percentage,
      grade: gradeInfo.grade,
      gradePoint: gradeInfo.gradePoint,
      remark: gradeInfo.remark,
      isPass: gradeInfo.isPass,
      examRemarks: markRecord?.remarks ?? "",
    };
  });

  const summary = calculateReportCardSummary(
    subjectsWithMarks.map((s) => ({
      maxMarks: s.maxMarks,
      passMarks: s.passMarks,
      marksObtained: s.marksObtained,
      isAbsent: s.isAbsent,
    })),
    exam.gradingSystem as any,
  );

  // U9: attendance over the session so far, not just the exam week.
  const range = await reportAttendanceRange(schoolId, exam);
  const attendances = await prisma.attendance.findMany({
    where: { studentId, date: { gte: range.from, lte: range.to } },
    select: { status: true },
  });

  return buildStudentReportCardPayload({
    school,
    exam,
    student,
    classSubjects,
    marksMap,
    attendances,
  });
}

/**
 * Days a report card's attendance covers (U9): from the start of the
 * academic session the exam falls in, up to the end of the exam. Without a
 * matching session, the exam's own dates.
 */
async function reportAttendanceRange(
  schoolId: string,
  exam: { startDate: Date; endDate: Date },
) {
  const session = await prisma.academicSession.findFirst({
    where: {
      schoolId,
      startDate: { lte: exam.startDate },
      endDate: { gte: exam.startDate },
    },
    select: { startDate: true },
    orderBy: { startDate: "desc" },
  });
  return { from: session?.startDate ?? exam.startDate, to: exam.endDate };
}

function buildStudentReportCardPayload({
  school,
  exam,
  student,
  classSubjects,
  marksMap,
  attendances,
}: {
  school: any;
  exam: any;
  student: any;
  classSubjects: any[];
  marksMap: Map<string, any>;
  attendances: { status: string }[];
}) {
  const subjectsWithMarks = classSubjects.map((subject) => {
    const markRecord = marksMap.get(subject.id);
    const marksObtained =
      markRecord?.marksObtained !== null &&
      markRecord?.marksObtained !== undefined
        ? Number(markRecord.marksObtained)
        : null;
    const isAbsent = markRecord?.isAbsent ?? false;

    const gradeInfo = calculateSubjectGrade(
      marksObtained,
      Number(subject.maxMarks),
      Number(subject.passMarks),
      isAbsent,
      exam.gradingSystem as any,
    );

    const percentage =
      marksObtained !== null && Number(subject.maxMarks) > 0
        ? Number(((marksObtained / Number(subject.maxMarks)) * 100).toFixed(1))
        : 0;

    return {
      subjectId: subject.id,
      subjectName: subject.subjectName,
      maxMarks: Number(subject.maxMarks),
      passMarks: Number(subject.passMarks),
      marksObtained,
      isAbsent,
      percentage,
      grade: gradeInfo.grade,
      gradePoint: gradeInfo.gradePoint,
      remark: gradeInfo.remark,
      isPass: gradeInfo.isPass,
      examRemarks: markRecord?.remarks ?? "",
    };
  });

  const summary = calculateReportCardSummary(
    subjectsWithMarks.map((s) => ({
      maxMarks: s.maxMarks,
      passMarks: s.passMarks,
      marksObtained: s.marksObtained,
      isAbsent: s.isAbsent,
    })),
    exam.gradingSystem as any,
  );

  const totalWorkingDays = attendances.length;
  const presentDays = attendances.filter(
    (a) =>
      a.status === "PRESENT" || a.status === "LATE" || a.status === "EXCUSED",
  ).length;

  // No attendance taken means unknown, not perfect attendance.
  const attendancePercentage =
    totalWorkingDays > 0
      ? Number(((presentDays / totalWorkingDays) * 100).toFixed(1))
      : null;

  return {
    school,
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      academicYear: exam.academicYear,
      gradingSystem: exam.gradingSystem,
      startDate: exam.startDate,
      endDate: exam.endDate,
    },
    student: {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      className: student.class?.name ?? "",
      sectionName: student.section?.name ?? "",
      parentName: student.parentName,
      dob: student.dateOfBirth,
      photoUrl: student.photoUrl,
      bloodGroup: student.bloodGroup,
    },
    subjects: subjectsWithMarks,
    summary,
    attendance: {
      totalWorkingDays,
      presentDays,
      percentage: attendancePercentage,
    },
  };
}

/** U4: returns { data } or { error }; see lib/action-result. */
export async function getSectionReportCards(
  ...args: Parameters<typeof getSectionReportCardsImpl>
) {
  return toActionResult(() => getSectionReportCardsImpl(...args));
}

async function getSectionReportCardsImpl(examId: string, sectionId: string) {
  const { user } = await requireExamAccess();
  const schoolId = user.schoolId;

  const [school, exam, section, rawStudents] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        logoUrl: true,
      },
    }),
    prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: {
        subjects: {
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: { id: true, classId: true },
    }),
    prisma.student.findMany({
      where: {
        schoolId,
        sectionId,
        isActive: true,
      },
      include: {
        class: true,
        section: true,
      },
    }),
  ]);

  if (!exam) throw new Error("Exam not found");
  if (!section) throw new Error("Section not found");

  // Sort students naturally by numeric roll number
  const students = [...rawStudents].sort((a, b) =>
    compareRollNumbers(a.rollNumber, b.rollNumber),
  );

  const studentIds = students.map((s) => s.id);
  const classSubjects = exam.subjects.filter(
    (s) => s.classId === section.classId,
  );
  const subjectIds = classSubjects.map((s) => s.id);

  const [allMarks, allAttendances] = await Promise.all([
    prisma.examMark.findMany({
      where: {
        examSubjectId: { in: subjectIds },
        studentId: { in: studentIds },
      },
    }),
    reportAttendanceRange(schoolId, exam).then((range) =>
      prisma.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          date: { gte: range.from, lte: range.to },
        },
        select: { studentId: true, status: true },
      }),
    ),
  ]);

  // Group marks by studentId -> (examSubjectId -> mark)
  const studentMarksMap = new Map<
    string,
    Map<string, (typeof allMarks)[number]>
  >();
  for (const mark of allMarks) {
    if (!studentMarksMap.has(mark.studentId)) {
      studentMarksMap.set(mark.studentId, new Map());
    }
    studentMarksMap.get(mark.studentId)!.set(mark.examSubjectId, mark);
  }

  // Group attendances by studentId
  const studentAttendancesMap = new Map<string, { status: string }[]>();
  for (const att of allAttendances) {
    const list = studentAttendancesMap.get(att.studentId);
    if (list) {
      list.push({ status: att.status });
    } else {
      studentAttendancesMap.set(att.studentId, [{ status: att.status }]);
    }
  }

  const reportCards = students.map((st) => {
    const marksMap = studentMarksMap.get(st.id) ?? new Map();
    const attendances = studentAttendancesMap.get(st.id) ?? [];
    return buildStudentReportCardPayload({
      school,
      exam,
      student: st,
      classSubjects,
      marksMap,
      attendances,
    });
  });

  return reportCards;
}
