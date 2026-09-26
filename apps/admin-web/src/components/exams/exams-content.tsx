"use client";

import { useState, useMemo } from "react";
import { ExamsListTab } from "./tabs/exams-list-tab";
import { MarksEntryTab } from "./tabs/marks-entry-tab";
import { ResultsTab } from "./tabs/results-tab";
import { ExamDialog } from "./exam-dialog";
import { SubjectConfigModal } from "./subject-config-modal";
import {
  Award,
  PenTool,
  FileText,
  Calendar,
  Plus,
  BookOpen,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryTab, useQueryState } from "@/hooks/use-query-state";
import { ConfigProvider, theme as antTheme } from "antd";
import { useTheme } from "next-themes";

interface ExamsContentProps {
  exams: any[];
  classes: any[];
  userRole?: string;
}

export function ExamsContent({
  exams,
  classes,
  userRole,
}: Readonly<ExamsContentProps>) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useQueryTab<
    "schedule" | "marks" | "results"
  >({
    paramKey: "tab",
    validTabs: ["schedule", "marks", "results"],
    defaultTab: "schedule",
  });
  const [selectedExamIdForTab, setSelectedExamIdForTab] = useQueryState<string>(
    "examId",
    "",
  );

  // Dialog State
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [dialogInitialData, setDialogInitialData] = useState<any>(null);
  const [subjectConfigExam, setSubjectConfigExam] = useState<any>(null);

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalExams = exams.length;
    let totalSubjectsCount = 0;
    let publishedCount = 0;

    for (const ex of exams) {
      totalSubjectsCount += ex.subjects?.length || 0;
      if (ex.isPublished) publishedCount++;
    }

    return {
      totalExams,
      totalSubjectsCount,
      publishedCount,
      classesCount: classes.length,
    };
  }, [exams, classes]);

  const handleOpenCreate = (templateData?: any) => {
    setDialogInitialData(templateData || null);
    setIsExamDialogOpen(true);
  };

  const handleOpenEdit = (exam: any) => {
    setDialogInitialData(exam);
    setIsExamDialogOpen(true);
  };

  const handleOpenSubjects = (exam: any) => {
    setSubjectConfigExam(exam);
  };

  const handleNavigateTab = (tab: "marks" | "results", examId?: string) => {
    if (examId) setSelectedExamIdForTab(examId);
    setActiveTab(tab);
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          borderRadius: 8,
          colorBgContainer: isDark ? "#09090b" : "#ffffff",
          colorBgElevated: isDark ? "#18181b" : "#ffffff",
          colorBorder: isDark ? "#27272a" : "#e4e4e7",
        },
      }}
    >
      <div className="p-6 space-y-6 w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Examinations & Report Cards</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage academic terms, subject evaluations, batch marks, and
              printable institutional marksheets
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Examination
          </button>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl border bg-card shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Total Exams
              </span>
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {metrics.totalExams}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Active session terms
            </p>
          </div>

          <div className="p-4 rounded-2xl border bg-card shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Allocated Subjects
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {metrics.totalSubjectsCount}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Across {metrics.classesCount} school classes
            </p>
          </div>

          <div className="p-4 rounded-2xl border bg-card shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Published Terms
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {metrics.publishedCount}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Visible to students & parents
            </p>
          </div>

          <div className="p-4 rounded-2xl border bg-card shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Grading Standard
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base font-bold tracking-tight text-foreground pt-1">
              CBSE 9-Point
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-GPA & Letter scale supported
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-border/80 gap-6">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition relative ${
              activeTab === "schedule"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Exams Schedule & Setup
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "schedule"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {exams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("marks")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition relative ${
              activeTab === "marks"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="w-4 h-4" />
            Batch Marks Entry
          </button>

          <button
            onClick={() => setActiveTab("results")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition relative ${
              activeTab === "results"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" />
            Report Cards & Marksheets
          </button>
        </div>

        {/* Active Tab View */}
        {activeTab === "schedule" && (
          <ExamsListTab
            exams={exams}
            classes={classes}
            onOpenCreate={handleOpenCreate}
            onOpenEdit={handleOpenEdit}
            onOpenSubjects={handleOpenSubjects}
            onNavigateTab={handleNavigateTab}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === "marks" && (
          <MarksEntryTab
            exams={exams}
            classes={classes}
            selectedExamIdProp={selectedExamIdForTab}
          />
        )}

        {activeTab === "results" && (
          <ResultsTab
            exams={exams}
            classes={classes}
            selectedExamIdProp={selectedExamIdForTab}
          />
        )}

        {/* Exam Dialog */}
        <ExamDialog
          isOpen={isExamDialogOpen}
          onClose={() => setIsExamDialogOpen(false)}
          initialData={dialogInitialData}
          classes={classes}
          onSuccess={handleRefresh}
        />

        {/* Subject Config Modal */}
        {subjectConfigExam && (
          <SubjectConfigModal
            isOpen={Boolean(subjectConfigExam)}
            onClose={() => setSubjectConfigExam(null)}
            exam={subjectConfigExam}
            classes={classes}
            onSuccess={handleRefresh}
          />
        )}
      </div>
    </ConfigProvider>
  );
}
