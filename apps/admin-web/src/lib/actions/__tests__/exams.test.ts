import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as examActions from "../exams";
import { getExams } from "../exams";
import { unwrapAction } from "../../action-result";

// U4: the actions return { data } or { error }; unwrap so failures throw
// (with their message) as they do in the components' try/catch.
const createExam = (...a: Parameters<typeof examActions.createExam>) =>
  examActions.createExam(...a).then(unwrapAction);
const addExamSubject = (...a: Parameters<typeof examActions.addExamSubject>) =>
  examActions.addExamSubject(...a).then(unwrapAction);
const saveBatchMarks = (...a: Parameters<typeof examActions.saveBatchMarks>) =>
  examActions.saveBatchMarks(...a).then(unwrapAction);
const getStudentReportCard = (
  ...a: Parameters<typeof examActions.getStudentReportCard>
) => examActions.getStudentReportCard(...a).then(unwrapAction);
const getSectionReportCards = (
  ...a: Parameters<typeof examActions.getSectionReportCards>
) => examActions.getSectionReportCards(...a).then(unwrapAction);
const deleteExam = (...a: Parameters<typeof examActions.deleteExam>) =>
  examActions.deleteExam(...a).then(unwrapAction);
import {
  calculateSubjectGrade,
  calculateReportCardSummary,
} from "../../grading";
import { prisma, purgeSchool, ExamType, GradingSystem } from "@schoolos/db";
import { auth } from "@schoolos/auth";

const schoolId = "exam-school-" + Math.random().toString(36).substring(7);

describe("Examinations & Report Cards Engine", () => {
  let classId: string;
  let sectionId: string;
  let student1Id: string;
  let student2Id: string;
  let examId: string;
  let examSubjectId: string;

  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "test-user", schoolId, role: "SUPER_ADMIN" },
    } as any);

    // Create required school
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Exams Test Academy",
        subdomain: "exam-" + Math.random().toString(36).substring(7),
        address: "123 Academic Way",
        city: "New Delhi",
      },
    });

    const c = await prisma.class.create({
      data: {
        schoolId,
        name: "Class 10",
        grade: 10,
      },
    });
    classId = c.id;

    const s = await prisma.section.create({
      data: {
        schoolId,
        classId,
        name: "A",
      },
    });
    sectionId = s.id;

    const runKey = Math.random().toString(36).substring(7);
    const st1 = await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        name: "Alice Sharma",
        parentName: "Mr. Sharma",
        parentPhone: "9876543210",
        admissionNumber: "ADM-EXAM-1-" + runKey,
        rollNumber: "1",
      },
    });
    student1Id = st1.id;

    const st2 = await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        name: "Bob Verma",
        parentName: "Mr. Verma",
        parentPhone: "9876543211",
        admissionNumber: "ADM-EXAM-2-" + runKey,
        rollNumber: "2",
      },
    });
    student2Id = st2.id;
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  it("should correctly evaluate CBSE 9-point grades and GPAs", () => {
    const a1 = calculateSubjectGrade(95, 100, 33, false, "CBSE_9_POINT");
    expect(a1.grade).toBe("A1");
    expect(a1.gradePoint).toBe(10);
    expect(a1.isPass).toBe(true);

    const b2 = calculateSubjectGrade(65, 100, 33, false, "CBSE_9_POINT");
    expect(b2.grade).toBe("B2");
    expect(b2.gradePoint).toBe(7);

    const failed = calculateSubjectGrade(25, 100, 33, false, "CBSE_9_POINT");
    expect(failed.grade).toBe("E");
    expect(failed.isPass).toBe(false);

    const absent = calculateSubjectGrade(null, 100, 33, true, "CBSE_9_POINT");
    expect(absent.grade).toBe("AB");
    expect(absent.isPass).toBe(false);
  });

  it("should correctly calculate report card summary and overall percentage", () => {
    const summary = calculateReportCardSummary(
      [
        { maxMarks: 100, passMarks: 33, marksObtained: 90, isAbsent: false },
        { maxMarks: 100, passMarks: 33, marksObtained: 80, isAbsent: false },
      ],
      "CBSE_9_POINT",
    );

    expect(summary.totalMaxMarks).toBe(200);
    expect(summary.totalMarksObtained).toBe(170);
    expect(summary.overallPercentage).toBe(85);
    expect(summary.result).toBe("PASSED");
  });

  it("should create an examination with subjects configured for a class", async () => {
    const exam = await createExam({
      name: "Term 1 Midterm Examination 2026-27",
      type: ExamType.TERM_1,
      academicYear: "2026-2027",
      gradingSystem: GradingSystem.CBSE_9_POINT,
      startDate: "2026-09-10",
      endDate: "2026-09-25",
      subjects: [
        {
          classId,
          subjectName: "Mathematics",
          maxMarks: 100,
          passMarks: 33,
        },
        {
          classId,
          subjectName: "Science",
          maxMarks: 100,
          passMarks: 33,
        },
      ],
    });

    expect(exam).toBeDefined();
    expect(exam.id).toBeDefined();
    expect(exam.name).toBe("Term 1 Midterm Examination 2026-27");
    examId = exam.id;

    const list = await getExams();
    const createdInList = list.find((e) => e.id === examId);
    expect(createdInList).toBeDefined();
    expect(createdInList?.subjects.length).toBe(2);

    examSubjectId = createdInList!.subjects[0].id;
  });

  it("should save batch marks for students in a class subject", async () => {
    const result = await saveBatchMarks(examSubjectId, [
      {
        studentId: student1Id,
        marksObtained: 95,
        isAbsent: false,
        remarks: "Excellent problem solving",
      },
      {
        studentId: student2Id,
        marksObtained: 28,
        isAbsent: false,
        remarks: "Needs practice in algebra",
      },
    ]);

    if (!result.success) throw new Error(result.error);
    expect(result.savedCount).toBe(2);

    const mark1 = await prisma.examMark.findUnique({
      where: {
        examSubjectId_studentId: {
          examSubjectId,
          studentId: student1Id,
        },
      },
    });
    expect(Number(mark1?.marksObtained)).toBe(95);
  });

  it("should generate a complete student report card with subjects, grades, and summary", async () => {
    const reportCard = await getStudentReportCard(examId, student1Id);

    expect(reportCard).toBeDefined();
    if ("error" in reportCard) throw new Error(String(reportCard.error));

    expect(reportCard.student.name).toBe("Alice Sharma");
    expect(reportCard.exam.name).toBe("Term 1 Midterm Examination 2026-27");
    expect(reportCard.subjects.length).toBe(2);

    const mathSubject = reportCard.subjects.find(
      (s) => s.subjectName === "Mathematics",
    );
    expect(mathSubject).toBeDefined();
    expect(mathSubject?.marksObtained).toBe(95);
    expect(mathSubject?.grade).toBe("A1");
    expect(mathSubject?.isPass).toBe(true);
  });

  it("should bulk fetch all report cards for a section", async () => {
    const sectionCards = await getSectionReportCards(examId, sectionId);
    expect(sectionCards.length).toBe(2);
    expect(sectionCards.map((c) => c.student.name)).toContain("Alice Sharma");
    expect(sectionCards.map((c) => c.student.name)).toContain("Bob Verma");
  });

  it("rejects invalid marks instead of saving 0 or the maximum", async () => {
    const result = await saveBatchMarks(examSubjectId, [
      { studentId: student1Id, marksObtained: 150 },
      { studentId: student2Id, marksObtained: -3 },
    ]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.invalidStudentIds?.sort()).toEqual(
      [student1Id, student2Id].sort(),
    );

    const mark1 = await prisma.examMark.findUnique({
      where: {
        examSubjectId_studentId: { examSubjectId, studentId: student1Id },
      },
    });
    expect(Number(mark1?.marksObtained)).toBe(95);
  });

  it("refuses to overwrite marks someone changed after the sheet was loaded", async () => {
    const loadedAt = new Date(Date.now() - 60_000).toISOString();
    await saveBatchMarks(examSubjectId, [
      { studentId: student2Id, marksObtained: 40 },
    ]);

    const stale = await saveBatchMarks(
      examSubjectId,
      [{ studentId: student2Id, marksObtained: 10 }],
      { since: loadedAt },
    );
    expect(stale.success).toBe(false);
    if (!stale.success) expect(stale.error).toMatch(/Bob Verma/);

    const fresh = await saveBatchMarks(
      examSubjectId,
      [{ studentId: student2Id, marksObtained: 41 }],
      { since: new Date().toISOString() },
    );
    expect(fresh.success).toBe(true);
  });

  it("locks marks once the exam's results are published", async () => {
    await prisma.exam.update({
      where: { id: examId },
      data: { isPublished: true },
    });
    try {
      const result = await saveBatchMarks(examSubjectId, [
        { studentId: student1Id, marksObtained: 50 },
      ]);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/published/i);
    } finally {
      await prisma.exam.update({
        where: { id: examId },
        data: { isPublished: false },
      });
    }
  });

  it("decides pass or fail by the subject's pass mark, not the grade band", () => {
    // 35/100 is a passing D band, but the pass mark is 40.
    const below = calculateSubjectGrade(35, 100, 40, false, "CBSE_9_POINT");
    expect(below.isPass).toBe(false);
    expect(below.grade).toBe("E");

    // 30/100 is below the 33% band, but the pass mark is 25.
    const above = calculateSubjectGrade(
      30,
      100,
      25,
      false,
      "PERCENTAGE_LETTER",
    );
    expect(above.isPass).toBe(true);
  });

  it("leaves unmarked subjects out of the totals and reports the result as pending", () => {
    const summary = calculateReportCardSummary(
      [
        { maxMarks: 100, passMarks: 33, marksObtained: 80 },
        { maxMarks: 100, passMarks: 33, marksObtained: null },
      ],
      "CBSE_9_POINT",
    );
    expect(summary.totalMaxMarks).toBe(100);
    expect(summary.overallPercentage).toBe(80);
    expect(summary.result).toBe("PENDING");
  });
});
