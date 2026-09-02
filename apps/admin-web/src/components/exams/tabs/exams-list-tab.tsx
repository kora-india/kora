"use client";

import { useState, useMemo } from "react";
import {
  Award,
  Calendar,
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Search,
  PenTool,
  FileText,
  Sparkles,
  Zap,
} from "lucide-react";
import { togglePublishExam, deleteExam } from "@/lib/actions/exams";
import { toast } from "sonner";
import { ExamType } from "@schoolos/db";
import { Input, Select } from "antd";

interface ExamsListTabProps {
  exams: any[];
  classes: any[];
  onOpenCreate: (templateData?: any) => void;
  onOpenEdit: (exam: any) => void;
  onOpenSubjects: (exam: any) => void;
  onNavigateTab: (tab: "marks" | "results", examId?: string) => void;
  onRefresh: () => void;
}

export function ExamsListTab({
  exams,
  classes,
  onOpenCreate,
  onOpenEdit,
  onOpenSubjects,
  onNavigateTab,
  onRefresh,
}: Readonly<ExamsListTabProps>) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const handleTogglePublish = async (examId: string, current: boolean) => {
    setLoadingId(examId);
    try {
      await togglePublishExam(examId);
      toast.success(
        current
          ? "Exam unpublished"
          : "Exam results published to students & parents",
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (examId: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${name}" and all associated marks?`,
      )
    ) {
      return;
    }

    try {
      await deleteExam(examId);
      toast.success("Exam deleted successfully");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete exam");
    }
  };

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.academicYear.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "ALL" || exam.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [exams, searchQuery, typeFilter]);

  // Quick Starter Templates
  const handleQuickTemplate = (
    type: ExamType,
    name: string,
    maxMarks: number,
    passMarks: number,
  ) => {
    onOpenCreate({
      name,
      type,
      academicYear: "2026-2027",
      defaultMaxMarks: maxMarks,
      defaultPassMarks: passMarks,
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      {exams.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border shadow-xs">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search examinations by title or year..."
              prefix={<Search className="w-4 h-4 text-muted-foreground mr-1" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              className="w-44"
              options={[
                { label: "All Categories", value: "ALL" },
                { label: "Term 1", value: ExamType.TERM_1 },
                { label: "Term 2", value: ExamType.TERM_2 },
                { label: "Half-Yearly", value: ExamType.HALF_YEARLY },
                { label: "Final Exam", value: ExamType.FINAL },
                { label: "Unit Test", value: ExamType.UNIT_TEST },
                { label: "Monthly Test", value: ExamType.MONTHLY_TEST },
              ]}
            />
          </div>
        </div>
      )}

      {/* Empty State with Quick-Start Templates */}
      {exams.length === 0 ? (
        <div className="rounded-3xl border bg-card p-6 sm:p-10 shadow-xs space-y-8">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center mx-auto shadow-sm">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Set Up Your First Examination
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create an exam schedule, allocate subjects with maximum & pass
              marks per class, and start entering batch student marks.
            </p>
          </div>

          {/* 3 Quick Starter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() =>
                handleQuickTemplate(
                  ExamType.TERM_1,
                  "Term 1 Examination 2026-27",
                  100,
                  33,
                )
              }
              className="group p-5 rounded-2xl border bg-background hover:border-violet-500 hover:shadow-md transition-all text-left space-y-3"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">
                  Recommended
                </span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">
                  Term 1 Examination
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Standard term assessment with core subjects across all classes
                  (Max 100, Pass 33).
                </p>
              </div>
              <div className="text-xs font-semibold text-violet-600 flex items-center gap-1 group-hover:underline">
                Create Term 1 &rarr;
              </div>
            </button>

            <button
              onClick={() =>
                handleQuickTemplate(
                  ExamType.HALF_YEARLY,
                  "Half-Yearly Examination 2026-27",
                  100,
                  33,
                )
              }
              className="group p-5 rounded-2xl border bg-background hover:border-indigo-500 hover:shadow-md transition-all text-left space-y-3"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Mid-Session
                </span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">
                  Half-Yearly Examination
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Mid-year scholastic evaluation with CBSE 9-point grading
                  scale.
                </p>
              </div>
              <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1 group-hover:underline">
                Create Half-Yearly &rarr;
              </div>
            </button>

            <button
              onClick={() =>
                handleQuickTemplate(
                  ExamType.UNIT_TEST,
                  "Unit Test 1 (2026-27)",
                  50,
                  18,
                )
              }
              className="group p-5 rounded-2xl border bg-background hover:border-emerald-500 hover:shadow-md transition-all text-left space-y-3"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                  Periodic
                </span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">
                  Unit / Monthly Test
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Short periodic test with quick 25/50 marks per subject.
                </p>
              </div>
              <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:underline">
                Create Unit Test &rarr;
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => {
            const subjectCount = exam.subjects?.length || 0;
            const startDate = new Date(exam.startDate).toLocaleDateString(
              "en-IN",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
              },
            );
            const endDate = new Date(exam.endDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={exam.id}
                className="rounded-2xl border bg-card p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800/40">
                        {exam.type.replace(/_/g, " ")}
                      </span>
                      <h3 className="text-base font-bold text-foreground mt-1.5 line-clamp-1">
                        {exam.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Session: {exam.academicYear}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleTogglePublish(exam.id, exam.isPublished)
                      }
                      disabled={loadingId === exam.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                        exam.isPublished
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100"
                      }`}
                      title={
                        exam.isPublished
                          ? "Click to unpublish"
                          : "Click to publish"
                      }
                    >
                      {exam.isPublished ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Published
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Draft
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Date Window:
                      </span>
                      <span className="font-medium text-foreground">
                        {startDate} – {endDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> Configured
                        Subjects:
                      </span>
                      <span className="font-semibold text-foreground">
                        {subjectCount} subjects
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Grading Scale:</span>
                      <span className="font-medium text-foreground">
                        {exam.gradingSystem === "CBSE_9_POINT"
                          ? "CBSE 9-Point"
                          : "Letter Scale"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="border-t pt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenSubjects(exam)}
                      className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 transition shadow-2xs"
                      title="Manage subjects and marks per class"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-violet-600" />{" "}
                      Subjects
                    </button>
                    <button
                      onClick={() => onNavigateTab("marks", exam.id)}
                      className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 transition shadow-2xs"
                      title="Batch enter marks"
                    >
                      <PenTool className="w-3.5 h-3.5 text-indigo-600" /> Marks
                    </button>
                    <button
                      onClick={() => onNavigateTab("results", exam.id)}
                      className="p-1.5 rounded-lg border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition shadow-2xs"
                      title="View Marksheets"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenEdit(exam)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                      title="Edit exam details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id, exam.name)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-muted-foreground transition"
                      title="Delete exam"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
