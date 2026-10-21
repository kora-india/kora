"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryState } from "@/hooks/use-query-state";
import { getExamMarksSheet, saveBatchMarks } from "@/lib/actions/exams";
import { calculateSubjectGrade } from "@/lib/grading";
import { toast } from "sonner";
import {
  BookOpen,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Select } from "antd";
import { useConfirm } from "@/components/ui/use-confirm";
import { unwrapAction } from "@/lib/action-result";

/** A typed mark that the server would reject (D11). Blank means "not entered". */
function isInvalidMark(value: string, maxMarks: number): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return (
    !Number.isFinite(n) ||
    n < 0 ||
    n > maxMarks ||
    Math.round(n * 100) !== n * 100
  );
}

interface MarksEntryTabProps {
  exams: any[];
  classes: any[];
  selectedExamIdProp?: string;
}

export function MarksEntryTab({
  exams,
  classes,
  selectedExamIdProp,
}: Readonly<MarksEntryTabProps>) {
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirm();
  const [selectedExamId, setSelectedExamId] = useQueryState<string>(
    "examId",
    selectedExamIdProp || exams[0]?.id || "",
  );

  useEffect(() => {
    if (selectedExamIdProp) {
      setSelectedExamId(selectedExamIdProp);
    }
  }, [selectedExamIdProp, setSelectedExamId]);

  const [selectedClassId, setSelectedClassId] = useQueryState<string>(
    "classId",
    classes[0]?.id || "",
  );
  const [selectedSectionId, setSelectedSectionId] = useQueryState<string>(
    "sectionId",
    "all",
  );
  const [selectedSubjectId, setSelectedSubjectId] = useQueryState<string>(
    "subjectId",
    "",
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any>(null);
  const [entries, setEntries] = useState<
    Record<
      string,
      { marksObtained: string; isAbsent: boolean; remarks: string }
    >
  >({});
  // What was loaded, to save only changed rows and detect unsaved edits.
  const [originalEntries, setOriginalEntries] = useState<typeof entries>({});
  const [loadedAt, setLoadedAt] = useState<string | undefined>();

  const isLocked = Boolean(sheetData?.examSubject?.isPublished);
  const maxMarksValue = Number(sheetData?.examSubject?.maxMarks ?? 0);
  const changedStudentIds = useMemo(
    () =>
      Object.keys(entries).filter((id) => {
        const now = entries[id];
        const before = originalEntries[id];
        return (
          !before ||
          now.marksObtained !== before.marksObtained ||
          now.isAbsent !== before.isAbsent ||
          (now.remarks || "") !== (before.remarks || "")
        );
      }),
    [entries, originalEntries],
  );
  const isDirty = changedStudentIds.length > 0;
  const invalidCount = useMemo(
    () =>
      Object.values(entries).filter(
        (e) => !e.isAbsent && isInvalidMark(e.marksObtained, maxMarksValue),
      ).length,
    [entries, maxMarksValue],
  );

  // Warn before leaving the page with unsaved marks.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /** Switching exam, class, section or subject reloads the sheet. */
  const confirmDiscard = async () =>
    !isDirty ||
    confirmAction({
      title: "Discard unsaved marks?",
      description:
        "You have marks on this sheet that aren't saved. Switching now loses them.",
      confirmLabel: "Discard marks",
    });

  // Active exam object
  const activeExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId],
  );

  // Filter subjects for the selected exam and selected class
  const availableSubjects = useMemo(() => {
    if (!activeExam || !activeExam.subjects) return [];
    return activeExam.subjects.filter(
      (s: any) => s.classId === selectedClassId,
    );
  }, [activeExam, selectedClassId]);

  // Active class object
  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId],
  );

  // Set default subject whenever availableSubjects changes
  useEffect(() => {
    if (availableSubjects.length > 0) {
      if (!availableSubjects.some((s: any) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    } else {
      setSelectedSubjectId("");
      setSheetData(null);
    }
  }, [availableSubjects, selectedSubjectId]);

  // Load marksheet data when subject or section changes
  const loadMarksheet = useCallback(async () => {
    if (!selectedSubjectId) return;

    setLoading(true);
    try {
      const data = unwrapAction(
        await getExamMarksSheet(
          selectedSubjectId,
          selectedSectionId === "all" ? undefined : selectedSectionId,
        ),
      );
      setSheetData(data);

      // Initialize local state
      const initialEntries: Record<string, any> = {};
      for (const st of data.students) {
        initialEntries[st.studentId] = {
          marksObtained:
            st.marksObtained !== null ? String(st.marksObtained) : "",
          isAbsent: st.isAbsent,
          remarks: st.remarks || "",
        };
      }
      setEntries(initialEntries);
      setOriginalEntries(initialEntries);
      setLoadedAt(data.loadedAt);
    } catch (err: any) {
      toast.error(err.message || "Failed to load marksheet");
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, selectedSectionId]);

  useEffect(() => {
    loadMarksheet();
  }, [loadMarksheet]);

  // Quick state mutator
  const handleMarksChange = (studentId: string, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marksObtained: value,
        isAbsent: false,
      },
    }));
  };

  const handleAbsentToggle = (studentId: string, isAbsent: boolean) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        isAbsent,
        marksObtained: isAbsent ? "" : prev[studentId]?.marksObtained || "",
      },
    }));
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      },
    }));
  };

  // Save Batch Marks: only the rows that changed since the sheet loaded
  const handleSave = async () => {
    if (!selectedSubjectId || !sheetData) return;
    if (isLocked) {
      toast.error(
        "Results for this exam are published. Unpublish the exam to change marks.",
      );
      return;
    }
    if (invalidCount > 0) {
      toast.error(
        `Fix ${invalidCount} invalid mark(s) first. Marks must be between 0 and ${maxMarksValue}.`,
      );
      return;
    }
    if (!isDirty) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const payload = changedStudentIds.map((studentId) => {
        const data = entries[studentId];
        return {
          studentId,
          marksObtained:
            data.isAbsent || data.marksObtained.trim() === ""
              ? null
              : Number(data.marksObtained),
          isAbsent: data.isAbsent,
          remarks: data.remarks,
        };
      });

      const res = unwrapAction(
        await saveBatchMarks(selectedSubjectId, payload, {
          since: loadedAt,
        }),
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Saved marks for ${res.savedCount} student${res.savedCount === 1 ? "" : "s"}`,
      );
      loadMarksheet();
    } catch (err: any) {
      toast.error(err.message || "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  // Shortcut for Fill Full Marks
  const handleFillMaxMarks = () => {
    if (!sheetData?.examSubject?.maxMarks) return;
    const max = String(sheetData.examSubject.maxMarks);
    setEntries((prev) => {
      const updated: any = {};
      for (const st of sheetData.students) {
        updated[st.studentId] = {
          marksObtained: max,
          isAbsent: false,
          remarks: prev[st.studentId]?.remarks || "",
        };
      }
      return updated;
    });
    toast.info("Filled maximum marks for all students");
  };

  // Shortcut for Clear All
  const handleClearAll = () => {
    setEntries((prev) => {
      const updated: any = {};
      for (const st of sheetData?.students || []) {
        updated[st.studentId] = {
          marksObtained: "",
          isAbsent: false,
          remarks: "",
        };
      }
      return updated;
    });
  };

  return (
    <>
      {confirmDialog}
      <div className="space-y-4">
        {/* Selector Ribbon */}
        <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Exam Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                1. Examination
              </label>
              <Select
                value={selectedExamId}
                onChange={async (val) => {
                  if (await confirmDiscard()) setSelectedExamId(val);
                }}
                className="w-full"
                options={exams.map((ex) => ({
                  label: `${ex.name} (${ex.academicYear})`,
                  value: ex.id,
                }))}
              />
            </div>

            {/* Class Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                2. Class
              </label>
              <Select
                value={selectedClassId}
                onChange={async (val) => {
                  if (!(await confirmDiscard())) return;
                  setSelectedClassId(val);
                  setSelectedSectionId("all");
                }}
                className="w-full"
                options={classes.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
              />
            </div>

            {/* Section Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                3. Section
              </label>
              <Select
                value={selectedSectionId}
                onChange={async (val) => {
                  if (await confirmDiscard()) setSelectedSectionId(val);
                }}
                className="w-full"
                options={[
                  { label: "All Sections", value: "all" },
                  ...(activeClass?.sections || []).map((sec: any) => ({
                    label: `Section ${sec.name}`,
                    value: sec.id,
                  })),
                ]}
              />
            </div>

            {/* Subject Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                4. Subject
              </label>
              <Select
                value={selectedSubjectId || undefined}
                onChange={async (val) => {
                  if (await confirmDiscard()) setSelectedSubjectId(val);
                }}
                disabled={availableSubjects.length === 0}
                placeholder={
                  availableSubjects.length === 0
                    ? "No subjects configured"
                    : "Select Subject"
                }
                className="w-full"
                options={availableSubjects.map((sub: any) => ({
                  label: `${sub.subjectName} (Max: ${Number(sub.maxMarks)}, Pass: ${Number(sub.passMarks)})`,
                  value: sub.id,
                }))}
              />
            </div>
          </div>

          {/* Quick Toolbar */}
          {sheetData && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {sheetData.examSubject.subjectName}
                </span>
                <span>•</span>
                <span>
                  Max: <strong>{sheetData.examSubject.maxMarks}</strong>
                </span>
                <span>•</span>
                <span>
                  Pass: <strong>{sheetData.examSubject.passMarks}</strong>
                </span>
                <span>•</span>
                <span>
                  Standard:{" "}
                  <strong>
                    {sheetData.examSubject.gradingSystem === "CBSE_9_POINT"
                      ? "CBSE"
                      : "Letter"}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillMaxMarks}
                  disabled={isLocked}
                  className="px-2.5 py-1 rounded-lg border bg-background hover:bg-muted text-[11px] font-medium text-foreground transition"
                >
                  Fill Max Marks
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isLocked}
                  className="px-2.5 py-1 rounded-lg border bg-background hover:bg-muted text-[11px] font-medium text-muted-foreground transition"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || isLocked || !isDirty}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Marks{isDirty ? ` (${changedStudentIds.length})` : ""}
                </button>
              </div>
            </div>
          )}
        </div>

        {isLocked && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Results for this exam are published, so these marks are read-only.
              Unpublish the exam to change them.
            </span>
          </div>
        )}

        {/* Marksheet Spreadsheet Table */}
        {availableSubjects.length === 0 ? (
          <div className="text-center py-12 border rounded-2xl bg-muted/10 text-muted-foreground text-xs space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="font-semibold text-foreground">
              No subjects configured for this class
            </p>
            <p>
              Please configure subjects for this class under the "Exams Schedule
              & Setup" tab first.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            <span className="text-xs font-medium">
              Loading class marksheet...
            </span>
          </div>
        ) : !sheetData || sheetData.students.length === 0 ? (
          <div className="text-center py-12 border rounded-2xl bg-muted/10 text-muted-foreground text-xs">
            No students found in the selected class / section.
          </div>
        ) : (
          <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Roll #</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3">Admission No</th>
                  <th className="py-3 px-3">Section</th>
                  <th className="py-3 px-3 w-36">
                    Marks (Max {sheetData.examSubject.maxMarks})
                  </th>
                  <th className="py-3 px-3 w-28 text-center">Absent?</th>
                  <th className="py-3 px-3 w-24 text-center">Grade</th>
                  <th className="py-3 px-4 w-52">Teacher Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sheetData.students.map((st: any) => {
                  const entry = entries[st.studentId] || {
                    marksObtained: "",
                    isAbsent: false,
                    remarks: "",
                  };
                  const numericMarks =
                    entry.marksObtained !== ""
                      ? Number(entry.marksObtained)
                      : null;
                  const gradeInfo = calculateSubjectGrade(
                    numericMarks,
                    sheetData.examSubject.maxMarks,
                    sheetData.examSubject.passMarks,
                    entry.isAbsent,
                    sheetData.examSubject.gradingSystem,
                  );

                  return (
                    <tr
                      key={st.studentId}
                      className={`hover:bg-muted/20 transition ${
                        entry.isAbsent
                          ? "bg-rose-50/20 dark:bg-rose-950/10"
                          : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-center text-foreground">
                        #{st.rollNumber}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-foreground">
                        {st.name}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">
                        {st.admissionNumber}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {st.sectionName}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min={0}
                          max={sheetData.examSubject.maxMarks}
                          step="0.5"
                          disabled={entry.isAbsent || isLocked}
                          placeholder="0.0"
                          value={entry.marksObtained}
                          onChange={(e) =>
                            handleMarksChange(st.studentId, e.target.value)
                          }
                          aria-invalid={isInvalidMark(
                            entry.marksObtained,
                            maxMarksValue,
                          )}
                          title={
                            isInvalidMark(entry.marksObtained, maxMarksValue)
                              ? `Enter a mark between 0 and ${maxMarksValue}`
                              : undefined
                          }
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono font-bold transition focus:ring-2 focus:ring-violet-500/20 ${
                            entry.isAbsent
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : isInvalidMark(
                                    entry.marksObtained,
                                    maxMarksValue,
                                  )
                                ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 border-rose-500 ring-2 ring-rose-500/30"
                                : gradeInfo.isPass
                                  ? "bg-background text-foreground"
                                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-300 dark:border-rose-800"
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.isAbsent}
                            disabled={isLocked}
                            onChange={(e) =>
                              handleAbsentToggle(st.studentId, e.target.checked)
                            }
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                          />
                        </label>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            entry.isAbsent
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                              : numericMarks === null
                                ? "bg-muted text-muted-foreground"
                                : gradeInfo.isPass
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}
                        >
                          {gradeInfo.grade}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          placeholder="Remark..."
                          value={entry.remarks}
                          disabled={isLocked}
                          onChange={(e) =>
                            handleRemarksChange(st.studentId, e.target.value)
                          }
                          className="w-full px-2.5 py-1 text-xs rounded-lg border bg-background"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
