"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { addExamSubject, deleteExamSubject } from "@/lib/actions/exams";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, Loader2 } from "lucide-react";

interface SubjectConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: any;
  classes: any[];
  onSuccess: () => void;
}

export function SubjectConfigModal({
  isOpen,
  onClose,
  exam,
  classes,
  onSuccess,
}: Readonly<SubjectConfigModalProps>) {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || "",
  );
  const [loading, setLoading] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [maxMarks, setMaxMarks] = useState(100);
  const [passMarks, setPassMarks] = useState(33);
  const [examDate, setExamDate] = useState("");

  if (!exam) return null;

  const currentSubjects = (exam.subjects || []).filter(
    (s: any) => s.classId === selectedClassId,
  );

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    setLoading(true);
    try {
      await addExamSubject({
        examId: exam.id,
        classId: selectedClassId,
        subjectName: subjectName.trim(),
        maxMarks,
        passMarks,
        examDate: examDate || undefined,
      });

      toast.success(`Subject "${subjectName}" added for class`);
      setSubjectName("");
      setExamDate("");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to add subject");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from this exam?`)) {
      return;
    }

    try {
      await deleteExamSubject(subjectId);
      toast.success("Subject removed");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove subject");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={`Configure Subjects — ${exam.name}`}
      description="Customize subjects, maximum marks, passing criteria, and dates per class"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Class Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 border-b">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedClassId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedClassId === c.id
                  ? "bg-violet-600 text-white shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Add Subject Form */}
        <form
          onSubmit={handleAddSubject}
          className="p-3.5 rounded-xl border bg-muted/20 space-y-3"
        >
          <p className="text-xs font-bold text-foreground">
            Add Subject to Selected Class
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                placeholder="Subject Name (e.g. Physics)"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border bg-background"
              />
            </div>
            <div>
              <input
                type="number"
                required
                min={1}
                placeholder="Max Marks"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border bg-background"
                title="Maximum Marks"
              />
            </div>
            <div>
              <input
                type="number"
                required
                min={1}
                placeholder="Pass Marks"
                value={passMarks}
                onChange={(e) => setPassMarks(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border bg-background"
                title="Passing Marks"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border bg-background"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !subjectName.trim()}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add Subject
            </button>
          </div>
        </form>

        {/* Configured Subjects Table */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>
              Configured Subjects for Class ({currentSubjects.length})
            </span>
          </p>

          {currentSubjects.length === 0 ? (
            <div className="text-center py-6 border rounded-xl bg-muted/10 text-muted-foreground text-xs">
              No subjects assigned to this class yet. Add subjects above.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="py-2 px-3">Subject</th>
                    <th className="py-2 px-3 text-right">Max Marks</th>
                    <th className="py-2 px-3 text-right">Pass Marks</th>
                    <th className="py-2 px-3">Exam Date</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentSubjects.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {sub.subjectName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {Number(sub.maxMarks)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {Number(sub.passMarks)}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {sub.examDate
                          ? new Date(sub.examDate).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteSubject(sub.id, sub.subjectName)
                          }
                          className="p-1 text-muted-foreground hover:text-rose-600 transition"
                          title="Delete subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
