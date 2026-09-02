"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createExam, updateExam } from "@/lib/actions/exams";
import { ExamType, GradingSystem } from "@schoolos/db";
import { toast } from "sonner";
import {
  Calendar,
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Select } from "antd";

interface ExamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  classes: any[];
  onSuccess: () => void;
}

const DEFAULT_SUBJECTS = [
  "English",
  "Mathematics",
  "Science",
  "Social Science",
  "Hindi",
];

export function ExamDialog({
  isOpen,
  onClose,
  initialData,
  classes,
  onSuccess,
}: Readonly<ExamDialogProps>) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ExamType>(ExamType.TERM_1);
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [gradingSystem, setGradingSystem] = useState<GradingSystem>(
    GradingSystem.CBSE_9_POINT,
  );
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
  );
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>(DEFAULT_SUBJECTS);
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [defaultMaxMarks, setDefaultMaxMarks] = useState(100);
  const [defaultPassMarks, setDefaultPassMarks] = useState(33);

  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setType(initialData.type || ExamType.TERM_1);
      setAcademicYear(initialData.academicYear || "2026-2027");
      setGradingSystem(initialData.gradingSystem || GradingSystem.CBSE_9_POINT);
      setStartDate(
        initialData.startDate
          ? new Date(initialData.startDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      );
      setEndDate(
        initialData.endDate
          ? new Date(initialData.endDate).toISOString().split("T")[0]
          : new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      );
      if (initialData.defaultMaxMarks) {
        setDefaultMaxMarks(initialData.defaultMaxMarks);
      }
      if (initialData.defaultPassMarks) {
        setDefaultPassMarks(initialData.defaultPassMarks);
      }
      if (!isEdit) {
        setSelectedClasses(classes.map((c) => c.id));
        setSubjectsList(DEFAULT_SUBJECTS);
      }
    } else {
      setName("");
      setType(ExamType.TERM_1);
      setAcademicYear("2026-2027");
      setGradingSystem(GradingSystem.CBSE_9_POINT);
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate(
        new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      );
      setSelectedClasses(classes.map((c) => c.id));
      setSubjectsList(DEFAULT_SUBJECTS);
      setDefaultMaxMarks(100);
      setDefaultPassMarks(33);
    }
  }, [initialData, classes, isOpen, isEdit]);

  const handleAddSubject = () => {
    if (
      newSubjectInput.trim() &&
      !subjectsList.includes(newSubjectInput.trim())
    ) {
      setSubjectsList([...subjectsList, newSubjectInput.trim()]);
      setNewSubjectInput("");
    }
  };

  const handleRemoveSubject = (sub: string) => {
    setSubjectsList(subjectsList.filter((s) => s !== sub));
  };

  const toggleClassSelection = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  const selectAllClasses = () => {
    setSelectedClasses(classes.map((c) => c.id));
  };

  const clearClasses = () => {
    setSelectedClasses([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide an exam name");
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await updateExam(initialData.id, {
          name,
          type,
          academicYear,
          gradingSystem,
          startDate,
          endDate,
        });
        toast.success("Exam updated successfully");
      } else {
        // Build initial subjects payload across selected classes
        const subjectsPayload: any[] = [];
        for (const classId of selectedClasses) {
          for (const sub of subjectsList) {
            subjectsPayload.push({
              classId,
              subjectName: sub,
              maxMarks: defaultMaxMarks,
              passMarks: defaultPassMarks,
            });
          }
        }

        await createExam({
          name,
          type,
          academicYear,
          gradingSystem,
          startDate,
          endDate,
          subjects: subjectsPayload,
        });
        toast.success("Exam created with subjects configured");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save exam");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={isEdit ? "Edit Examination" : "Create New Examination"}
      description="Configure term dates, grading system, and subjects per class"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Exam Title
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Term 1 Examination 2026-27"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition shadow-2xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Exam Category
            </label>
            <Select
              value={type}
              onChange={(val) => setType(val as ExamType)}
              className="w-full"
              options={[
                { label: "Term 1", value: ExamType.TERM_1 },
                { label: "Term 2", value: ExamType.TERM_2 },
                { label: "Half-Yearly", value: ExamType.HALF_YEARLY },
                { label: "Final Exam", value: ExamType.FINAL },
                { label: "Unit Test", value: ExamType.UNIT_TEST },
                { label: "Periodic Test", value: ExamType.PERIODIC_TEST },
                { label: "Monthly Test", value: ExamType.MONTHLY_TEST },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Academic Session
            </label>
            <input
              type="text"
              required
              placeholder="2026-2027"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border bg-background focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Grading Standard
            </label>
            <Select
              value={gradingSystem}
              onChange={(val) => setGradingSystem(val as GradingSystem)}
              className="w-full"
              options={[
                {
                  label: "CBSE 9-Point (A1 to E)",
                  value: GradingSystem.CBSE_9_POINT,
                },
                {
                  label: "Letter Scale (A+ to F)",
                  value: GradingSystem.PERCENTAGE_LETTER,
                },
                {
                  label: "Marks Only (Pass/Fail)",
                  value: GradingSystem.MARKS_ONLY,
                },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Start
              Date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border bg-background focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> End
              Date
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border bg-background focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
            />
          </div>
        </div>

        {/* Quick Subject & Class Setup on creation */}
        {!isEdit && (
          <div className="border rounded-2xl p-4 bg-muted/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Quick Subject & Class
                Allocation
              </p>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllClasses}
                  className="text-violet-600 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={clearClasses}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Class Pills */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                {classes.map((c) => {
                  const isSelected = selectedClasses.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClassSelection(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? "bg-violet-600 text-white shadow-2xs"
                          : "bg-background border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Tags */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground block">
                Assigned Core Subjects:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {subjectsList.map((sub) => (
                  <span
                    key={sub}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background border text-xs font-semibold text-foreground shadow-2xs"
                  >
                    {sub}
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(sub)}
                      className="text-muted-foreground hover:text-rose-500 transition p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 pt-1.5">
                <input
                  type="text"
                  placeholder="Add custom subject (e.g. Sanskrit, Computer)..."
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubject();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border bg-background"
                />
                <button
                  type="button"
                  onClick={handleAddSubject}
                  className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Max & Pass Marks Default */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block">
                  Default Max Marks
                </label>
                <input
                  type="number"
                  min={1}
                  value={defaultMaxMarks}
                  onChange={(e) => setDefaultMaxMarks(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block">
                  Default Pass Marks
                </label>
                <input
                  type="number"
                  min={1}
                  value={defaultPassMarks}
                  onChange={(e) => setDefaultPassMarks(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border bg-background"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Update Exam" : "Create Examination"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
