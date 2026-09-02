/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  Printer,
  Award,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from "lucide-react";

interface ReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportCard: any;
  bulkReportCards?: any[];
}

export function ReportCardModal({
  isOpen,
  onClose,
  reportCard,
  bulkReportCards,
}: Readonly<ReportCardModalProps>) {
  const printRef = useRef<HTMLDivElement>(null);

  const isBulk = Boolean(bulkReportCards && bulkReportCards.length > 0);
  const cardsToRender = isBulk
    ? bulkReportCards!
    : reportCard
      ? [reportCard]
      : [];

  if (cardsToRender.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={
        isBulk
          ? `Batch Marksheets (${cardsToRender.length} Students)`
          : "Academic Report Card"
      }
      description="Official institutional marksheet and scholastic assessment"
      className="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Top Print Trigger */}
        <div className="flex items-center justify-end pb-2 border-b">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            {isBulk ? "Print All Marksheets" : "Print Report Card"}
          </button>
        </div>

        <div ref={printRef} className="space-y-8">
          {cardsToRender.map((card, cardIndex) => (
            <div
              key={card.student.id || cardIndex}
              className="report-card-page bg-card border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-foreground relative overflow-hidden"
              style={{
                pageBreakAfter:
                  cardIndex < cardsToRender.length - 1 ? "always" : "auto",
              }}
            >
              {/* Watermark Logo in Background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                <GraduationCap className="w-96 h-96" />
              </div>

              {/* Institutional Header */}
              <div className="border-b-2 border-primary/20 pb-4 text-center space-y-1.5 relative">
                <div className="flex items-center justify-center gap-3">
                  {card.school.logoUrl ? (
                    <img
                      src={card.school.logoUrl}
                      alt={card.school.name}
                      className="w-12 h-12 object-contain rounded-full border shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {card.school.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primary uppercase">
                      {card.school.name}
                    </h1>
                    <p className="text-[11px] text-muted-foreground">
                      {[
                        card.school.address,
                        card.school.city,
                        card.school.state,
                        card.school.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>

                <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mt-1">
                  {card.exam.name} • Session {card.exam.academicYear}
                </div>
              </div>

              {/* Student Profile Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/30 border text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Student Name
                  </span>
                  <p className="font-bold text-sm text-foreground">
                    {card.student.name}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Class & Section
                  </span>
                  <p className="font-semibold text-foreground">
                    {card.student.className} - {card.student.sectionName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Roll Number
                  </span>
                  <p className="font-semibold text-foreground">
                    #{card.student.rollNumber}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Admission No
                  </span>
                  <p className="font-semibold text-foreground">
                    {card.student.admissionNumber}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Father / Guardian
                  </span>
                  <p className="font-medium text-foreground">
                    {card.student.parentName || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Date of Birth
                  </span>
                  <p className="font-medium text-foreground">
                    {card.student.dob
                      ? new Date(card.student.dob).toLocaleDateString("en-IN")
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Attendance
                  </span>
                  <p className="font-medium text-foreground">
                    {card.attendance.presentDays} /{" "}
                    {card.attendance.totalWorkingDays} (
                    {card.attendance.percentage}%)
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Grading Standard
                  </span>
                  <p className="font-medium text-foreground">
                    {card.exam.gradingSystem === "CBSE_9_POINT"
                      ? "CBSE 9-Point Scale"
                      : "Standard Letter Scale"}
                  </p>
                </div>
              </div>

              {/* Scholastic Marks Table */}
              <div className="overflow-hidden border rounded-xl shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-3 text-right">Max Marks</th>
                      <th className="py-2.5 px-3 text-right">Pass Marks</th>
                      <th className="py-2.5 px-3 text-right">Marks Obtained</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3 text-right">Grade Point</th>
                      <th className="py-2.5 px-4">Evaluation Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {card.subjects.map((sub: any) => (
                      <tr key={sub.subjectId} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          {sub.subjectName}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {sub.maxMarks}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {sub.passMarks}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          {sub.isAbsent ? (
                            <span className="text-rose-600 font-bold">
                              ABSENT
                            </span>
                          ) : sub.marksObtained !== null ? (
                            <span
                              className={
                                sub.isPass ? "text-foreground" : "text-rose-600"
                              }
                            >
                              {sub.marksObtained}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              sub.isPass
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {sub.grade}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {sub.gradePoint.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                          {sub.remark}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total Row */}
                  <tfoot className="bg-muted/40 font-bold border-t">
                    <tr>
                      <td className="py-2.5 px-4">Grand Total</td>
                      <td className="py-2.5 px-3 text-right">
                        {card.summary.totalMaxMarks}
                      </td>
                      <td className="py-2.5 px-3 text-right">—</td>
                      <td className="py-2.5 px-3 text-right text-primary text-sm">
                        {card.summary.totalMarksObtained} /{" "}
                        {card.summary.totalMaxMarks}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-xs font-bold">
                          {card.summary.overallGrade}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {card.summary.cgpa.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">
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
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Performance Metrics & Remarks Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Overall Percentage
                  </span>
                  <p className="text-xl font-black text-primary">
                    {card.summary.overallPercentage}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Cumulative Grade Point: {card.summary.cgpa}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Result Evaluation
                  </span>
                  <p
                    className={`text-base font-bold ${
                      card.summary.result === "PASSED"
                        ? "text-emerald-600"
                        : card.summary.result === "COMPARTMENT"
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {card.summary.result === "PASSED"
                      ? "PROMOTED / PASSED"
                      : card.summary.result === "COMPARTMENT"
                        ? "ELIGIBLE FOR COMPARTMENT"
                        : "NEEDS IMPROVEMENT"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {card.summary.failedSubjectsCount === 0
                      ? "Cleared all scholastic subjects"
                      : `${card.summary.failedSubjectsCount} subject(s) below passing mark`}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Teacher Remark
                  </span>
                  <p className="text-xs font-medium italic text-foreground">
                    {card.summary.overallPercentage >= 80
                      ? "Exceptional performance, demonstrated high academic proficiency."
                      : card.summary.overallPercentage >= 60
                        ? "Consistent and good effort. Continues to make steady progress."
                        : "Shows potential, encouraged to dedicate extra revision on core subjects."}
                  </p>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs">
                <div className="border-t border-muted-foreground/30 pt-2">
                  <p className="font-semibold text-foreground">Class Teacher</p>
                  <span className="text-[10px] text-muted-foreground">
                    Signature
                  </span>
                </div>
                <div className="border-t border-muted-foreground/30 pt-2">
                  <p className="font-semibold text-foreground">
                    Exam Coordinator
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    Signature
                  </span>
                </div>
                <div className="border-t border-muted-foreground/30 pt-2">
                  <p className="font-semibold text-foreground">Principal</p>
                  <span className="text-[10px] text-muted-foreground">
                    Signature & Seal
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Global Print Styles */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .report-card-page,
            .report-card-page * {
              visibility: visible;
            }
            .report-card-page {
              position: relative;
              left: 0;
              top: 0;
              width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
              box-shadow: none !important;
              border: 1px solid #ccc !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}</style>
      </div>
    </Dialog>
  );
}
