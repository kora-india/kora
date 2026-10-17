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
  /** PENDING while any subject still has no marks entered. */
  result: "PASSED" | "FAILED" | "COMPARTMENT" | "ABSENT" | "PENDING";
  failedSubjectsCount: number;
}

/** Grade for a percentage on the system's bands, before the pass mark is applied. */
function gradeBand(
  percentage: number,
  gradingSystem: GradingSystemType,
): Omit<GradeResult, "isPass"> {
  if (gradingSystem === "CBSE_9_POINT") {
    if (percentage >= 91)
      return { grade: "A1", gradePoint: 10.0, remark: "Outstanding" };
    if (percentage >= 81)
      return { grade: "A2", gradePoint: 9.0, remark: "Excellent" };
    if (percentage >= 71)
      return { grade: "B1", gradePoint: 8.0, remark: "Very Good" };
    if (percentage >= 61)
      return { grade: "B2", gradePoint: 7.0, remark: "Good" };
    if (percentage >= 51)
      return { grade: "C1", gradePoint: 6.0, remark: "Above Average" };
    if (percentage >= 41)
      return { grade: "C2", gradePoint: 5.0, remark: "Average" };
    if (percentage >= 33)
      return { grade: "D", gradePoint: 4.0, remark: "Pass" };
    return FAILING_GRADE.CBSE_9_POINT;
  }
  if (gradingSystem === "PERCENTAGE_LETTER") {
    if (percentage >= 90)
      return { grade: "A+", gradePoint: 10.0, remark: "Outstanding" };
    if (percentage >= 80)
      return { grade: "A", gradePoint: 9.0, remark: "Excellent" };
    if (percentage >= 70)
      return { grade: "B+", gradePoint: 8.0, remark: "Very Good" };
    if (percentage >= 60)
      return { grade: "B", gradePoint: 7.0, remark: "Good" };
    if (percentage >= 50)
      return { grade: "C", gradePoint: 6.0, remark: "Average" };
    if (percentage >= 35)
      return { grade: "D", gradePoint: 4.0, remark: "Pass" };
    return FAILING_GRADE.PERCENTAGE_LETTER;
  }
  return { grade: "PASS", gradePoint: percentage / 10, remark: "Satisfactory" };
}

const FAILING_GRADE: Record<
  "CBSE_9_POINT" | "PERCENTAGE_LETTER",
  Omit<GradeResult, "isPass">
> = {
  CBSE_9_POINT: { grade: "E", gradePoint: 0.0, remark: "Needs Improvement" },
  PERCENTAGE_LETTER: { grade: "F", gradePoint: 0.0, remark: "Fail" },
};

/**
 * Calculates grade and grade points for an individual subject.
 *
 * D12: pass or fail follows the subject's own pass mark, not the grade bands.
 * Below the pass mark a student gets the system's failing grade even if their
 * percentage falls in a passing band; at or above it they pass even in the
 * lowest band.
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
  // A missing or invalid pass mark falls back to the usual 33%.
  const passMark =
    Number.isFinite(passMarks) && passMarks > 0 ? passMarks : validMax * 0.33;
  const isPass = marksObtained >= passMark;

  if (gradingSystem === "MARKS_ONLY") {
    return {
      grade: isPass ? "PASS" : "FAIL",
      gradePoint: percentage / 10,
      remark: isPass ? "Satisfactory" : "Needs Improvement",
      isPass,
    };
  }

  if (!isPass) return { ...FAILING_GRADE[gradingSystem], isPass: false };
  return { ...gradeBand(percentage, gradingSystem), isPass: true };
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
  let gradedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let allAbsent = true;

  for (const s of subjects) {
    const marked =
      !s.isAbsent && s.marksObtained !== null && s.marksObtained !== undefined;

    // D12: a subject with no marks yet is left out of the totals instead of
    // counting as zero, so percentages aren't dragged down mid-way through
    // marking.
    if (!s.isAbsent && !marked) {
      pendingCount++;
      continue;
    }

    totalMax += Number(s.maxMarks) || 0;
    gradedCount++;

    if (marked) {
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
      // Absent: counts as attempted with zero marks.
      failedCount++;
    }
  }

  if (gradedCount === 0) {
    return {
      totalMaxMarks: 0,
      totalMarksObtained: 0,
      overallPercentage: 0,
      overallGrade: "-",
      cgpa: 0,
      result: "PENDING",
      failedSubjectsCount: 0,
    };
  }

  if (allAbsent && pendingCount === 0) {
    return {
      totalMaxMarks: totalMax,
      totalMarksObtained: 0,
      overallPercentage: 0,
      overallGrade: "AB",
      cgpa: 0,
      result: "ABSENT",
      failedSubjectsCount: gradedCount,
    };
  }

  const overallPercentage =
    totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const cgpa = Number((totalGradePoints / gradedCount).toFixed(2));

  // Compute Overall Grade based on overall percentage
  const overallGradeInfo = calculateSubjectGrade(
    overallPercentage,
    100,
    33,
    false,
    gradingSystem,
  );

  let result: ReportCardSummary["result"] = "PASSED";
  if (pendingCount > 0) {
    result = "PENDING";
  } else if (failedCount === 1) {
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
