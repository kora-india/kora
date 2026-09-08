"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryState } from "@/hooks/use-query-state";
import {
  getSectionReportCards,
  getStudentReportCard,
} from "@/lib/actions/exams";
import { ReportCardModal } from "../report-card-modal";
import { toast } from "sonner";
import {
  Printer,
  Award,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Search,
} from "lucide-react";
import { Input, Select } from "antd";

interface ResultsTabProps {
  exams: any[];
  classes: any[];
  selectedExamIdProp?: string;
}

export function ResultsTab({
  exams,
  classes,
  selectedExamIdProp,
}: Readonly<ResultsTabProps>) {
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
    "",
  );

  const [loading, setLoading] = useState(false);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useQueryState<string>("q", "");

  // Modal State
  const [activeModalReportCard, setActiveModalReportCard] = useState<any>(null);
  const [bulkPrintCards, setBulkPrintCards] = useState<any[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Active class object
  const activeClass = classes.find((c) => c.id === selectedClassId);

  // Set default section when class changes
  useEffect(() => {
    if (activeClass?.sections && activeClass.sections.length > 0) {
      setSelectedSectionId(activeClass.sections[0].id);
    } else {
      setSelectedSectionId("");
      setReportCards([]);
    }
  }, [activeClass]);

  const loadResults = useCallback(async () => {
    if (!selectedExamId || !selectedSectionId) return;

    setLoading(true);
    try {
      const data = await getSectionReportCards(
        selectedExamId,
        selectedSectionId,
      );
      setReportCards(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load class results");
    } finally {
      setLoading(false);
    }
  }, [selectedExamId, selectedSectionId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const filteredCards = reportCards.filter(
    (card) =>
      card.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.student.rollNumber.includes(searchTerm) ||
      card.student.admissionNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  // Open single report card
  const handleViewSingle = (card: any) => {
    setActiveModalReportCard(card);
    setBulkPrintCards(null);
    setIsModalOpen(true);
  };

  // Open bulk report cards for the whole section
  const handlePrintAll = () => {
    if (reportCards.length === 0) {
      toast.error("No student report cards available to print");
      return;
    }
    setActiveModalReportCard(null);
    setBulkPrintCards(reportCards);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Selector Ribbon */}
      <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Exam Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              1. Examination
            </label>
            <Select
              value={selectedExamId}
              onChange={setSelectedExamId}
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
              onChange={setSelectedClassId}
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
              onChange={setSelectedSectionId}
              className="w-full"
              options={(activeClass?.sections || []).map((sec: any) => ({
                label: `Section ${sec.name}`,
                value: sec.id,
              }))}
            />
          </div>
        </div>

        {/* Action Header & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
          <div className="flex-1 max-w-xs">
            <Input
              placeholder="Search by student name or roll #..."
              prefix={<Search className="w-4 h-4 text-muted-foreground mr-1" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintAll}
              disabled={loading || reportCards.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Bulk Print Class Marksheets ({reportCards.length})
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          <span className="text-xs font-medium">
            Aggregating marks and generating report cards...
          </span>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-12 border rounded-2xl bg-muted/10 text-muted-foreground text-xs space-y-2">
          <Users className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="font-semibold text-foreground">
            No student results found
          </p>
          <p>
            Make sure students are enrolled in this section and marks have been
            entered.
          </p>
        </div>
      ) : (
        <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Roll #</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-3">Admission No</th>
                <th className="py-3 px-3 text-right">Total Marks</th>
                <th className="py-3 px-3 text-right">Percentage</th>
                <th className="py-3 px-3 text-center">Overall Grade</th>
                <th className="py-3 px-3">Result Status</th>
                <th className="py-3 px-3">Attendance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCards.map((card) => (
                <tr
                  key={card.student.id}
                  className="hover:bg-muted/20 transition"
                >
                  <td className="py-3 px-4 font-mono font-bold text-center text-foreground">
                    #{card.student.rollNumber}
                  </td>
                  <td className="py-3 px-4 font-semibold text-foreground">
                    {card.student.name}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground font-mono">
                    {card.student.admissionNumber}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                    {card.summary.totalMarksObtained} /{" "}
                    {card.summary.totalMaxMarks}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-primary">
                    {card.summary.overallPercentage}%
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-primary/15 text-primary">
                      {card.summary.overallGrade}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        card.summary.result === "PASSED"
                          ? "text-emerald-600"
                          : card.summary.result === "COMPARTMENT"
                            ? "text-amber-600"
                            : "text-rose-600"
                      }`}
                    >
                      {card.summary.result === "PASSED" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      {card.summary.result}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {card.attendance.percentage}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleViewSingle(card)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-background hover:bg-muted text-xs font-semibold text-foreground transition shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-violet-600" />{" "}
                      Marksheet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Card Printable Modal */}
      <ReportCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reportCard={activeModalReportCard}
        bulkReportCards={bulkPrintCards || undefined}
      />
    </div>
  );
}
