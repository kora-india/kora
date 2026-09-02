import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  createExam,
  getExams,
  addExamSubject,
  saveBatchMarks,
  getStudentReportCard,
  getSectionReportCards,
  deleteExam,
} from "../exams";
import {
  calculateSubjectGrade,
  calculateReportCardSummary,
} from "../../grading";
import { prisma, ExamType, GradingSystem } from "@schoolos/db";
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
    await prisma.school.deleteMany({ where: { id: schoolId } });
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

    expect(result.success).toBe(true);
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
});
