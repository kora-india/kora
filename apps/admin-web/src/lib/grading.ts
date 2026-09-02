export type GradingSystemType =
  | "CBSE_9_POINT"
  | "PERCENTAGE_LETTER"
  | "MARKS_ONLY";

export interface GradeResult {
  grade: string;
  gradePoint: number;
  remark: string;
  isPass: boolean;
}

export interface SubjectMarksInput {
  subjectName?: string;
  maxMarks: number;
  passMarks: number;
  marksObtained: number | null;
  isAbsent?: boolean;
}

export interface ReportCardSummary {
  totalMaxMarks: number;
  totalMarksObtained: number;
  overallPercentage: number;
  overallGrade: string;
  cgpa: number;
  result: "PASSED" | "FAILED" | "COMPARTMENT" | "ABSENT";
  failedSubjectsCount: number;
}

/**
 * Calculates grade and grade points for an individual subject
 */
export function calculateSubjectGrade(
  marksObtained: number | null,
  maxMarks: number,
  passMarks: number,
  isAbsent = false,
  gradingSystem: GradingSystemType = "CBSE_9_POINT",
): GradeResult {
  if (isAbsent || marksObtained === null || marksObtained === undefined) {
    return {
      grade: isAbsent ? "AB" : "-",
      gradePoint: 0,
      remark: isAbsent ? "Absent" : "Pending",
      isPass: false,
    };
  }

  const validMax = maxMarks > 0 ? maxMarks : 100;
  const percentage = (marksObtained / validMax) * 100;
  const isPass = marksObtained >= passMarks;

  if (gradingSystem === "CBSE_9_POINT") {
    if (percentage >= 91)
      return {
        grade: "A1",
        gradePoint: 10.0,
        remark: "Outstanding",
        isPass: true,
      };
    if (percentage >= 81)
      return {
        grade: "A2",
        gradePoint: 9.0,
        remark: "Excellent",
        isPass: true,
      };
    if (percentage >= 71)
      return {
        grade: "B1",
        gradePoint: 8.0,
        remark: "Very Good",
        isPass: true,
      };
    if (percentage >= 61)
      return { grade: "B2", gradePoint: 7.0, remark: "Good", isPass: true };
    if (percentage >= 51)
      return {
        grade: "C1",
        gradePoint: 6.0,
        remark: "Above Average",
        isPass: true,
      };
    if (percentage >= 41)
      return { grade: "C2", gradePoint: 5.0, remark: "Average", isPass: true };
    if (percentage >= 33)
      return { grade: "D", gradePoint: 4.0, remark: "Pass", isPass: true };
    return {
      grade: "E",
      gradePoint: 0.0,
      remark: "Needs Improvement",
      isPass: false,
    };
  }

  if (gradingSystem === "PERCENTAGE_LETTER") {
    if (percentage >= 90)
      return {
        grade: "A+",
        gradePoint: 10.0,
        remark: "Outstanding",
        isPass: true,
      };
    if (percentage >= 80)
      return { grade: "A", gradePoint: 9.0, remark: "Excellent", isPass: true };
    if (percentage >= 70)
      return {
        grade: "B+",
        gradePoint: 8.0,
        remark: "Very Good",
        isPass: true,
      };
    if (percentage >= 60)
      return { grade: "B", gradePoint: 7.0, remark: "Good", isPass: true };
    if (percentage >= 50)
      return { grade: "C", gradePoint: 6.0, remark: "Average", isPass: true };
    if (percentage >= 35)
      return { grade: "D", gradePoint: 4.0, remark: "Pass", isPass: true };
    return { grade: "F", gradePoint: 0.0, remark: "Fail", isPass: false };
  }

  // MARKS_ONLY
  return {
    grade: isPass ? "PASS" : "FAIL",
    gradePoint: percentage / 10,
    remark: isPass ? "Satisfactory" : "Needs Improvement",
    isPass,
  };
}

/**
 * Aggregates overall performance, percentage, GPA, and pass/fail result across all exam subjects
 */
export function calculateReportCardSummary(
  subjects: SubjectMarksInput[],
  gradingSystem: GradingSystemType = "CBSE_9_POINT",
): ReportCardSummary {
  if (!subjects || subjects.length === 0) {
    return {
      totalMaxMarks: 0,
      totalMarksObtained: 0,
      overallPercentage: 0,
      overallGrade: "-",
      cgpa: 0,
      result: "ABSENT",
      failedSubjectsCount: 0,
    };
  }

  let totalMax = 0;
  let totalObtained = 0;
  let totalGradePoints = 0;
  let failedCount = 0;
  let allAbsent = true;

  for (const s of subjects) {
    totalMax += Number(s.maxMarks) || 0;

    if (
      !s.isAbsent &&
      s.marksObtained !== null &&
      s.marksObtained !== undefined
    ) {
      allAbsent = false;
      const obtained = Number(s.marksObtained);
      totalObtained += obtained;

      const gradeInfo = calculateSubjectGrade(
        obtained,
        Number(s.maxMarks) || 100,
        Number(s.passMarks) || 33,
        false,
        gradingSystem,
      );

      totalGradePoints += gradeInfo.gradePoint;
      if (!gradeInfo.isPass) {
        failedCount++;
      }
    } else {
      if (s.isAbsent) {
        failedCount++;
      }
    }
  }

  if (allAbsent) {
    return {
      totalMaxMarks: totalMax,
      totalMarksObtained: 0,
      overallPercentage: 0,
      overallGrade: "AB",
      cgpa: 0,
      result: "ABSENT",
      failedSubjectsCount: subjects.length,
    };
  }

  const overallPercentage =
    totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const cgpa =
    subjects.length > 0
      ? Number((totalGradePoints / subjects.length).toFixed(2))
      : 0;

  // Compute Overall Grade based on overall percentage
  const overallGradeInfo = calculateSubjectGrade(
    overallPercentage,
    100,
    33,
    false,
    gradingSystem,
  );

  let result: "PASSED" | "FAILED" | "COMPARTMENT" | "ABSENT" = "PASSED";
  if (failedCount === 1) {
    result = "COMPARTMENT";
  } else if (failedCount > 1) {
    result = "FAILED";
  }

  return {
    totalMaxMarks: totalMax,
    totalMarksObtained: Number(totalObtained.toFixed(2)),
    overallPercentage,
    overallGrade: overallGradeInfo.grade,
    cgpa,
    result,
    failedSubjectsCount: failedCount,
  };
}
