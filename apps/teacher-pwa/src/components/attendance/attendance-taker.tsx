"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, XCircle, Send, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface AttendanceTakerProps {
  students: any[];
  teacher: any;
  existingAttendance: Record<string, string>;
  teacherId: string;
  schoolId: string;
}

type Status = "PRESENT" | "ABSENT" | null;

export function AttendanceTaker({ students, teacher, existingAttendance, teacherId, schoolId }: AttendanceTakerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [attendance, setAttendance] = useState<Record<string, Status>>(() => {
    const init: Record<string, Status> = {};
    students.forEach((s) => {
      init[s.id] = (existingAttendance[s.id] as Status) ?? "PRESENT";
    });
    return init;
  });

  const marked = Object.values(attendance).filter(Boolean).length;
  const presentCount = Object.values(attendance).filter((s) => s === "PRESENT").length;
  const pct = students.length > 0 ? Math.round((marked / students.length) * 100) : 0;

  const toggle = (studentId: string, status: Status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = async () => {
    const records = Object.entries(attendance).map(([studentId, status]) => ({
      studentId,
      status: status ?? "PRESENT",
    }));

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: teacher.assignedClassId,
          sectionId: teacher.assignedSectionId,
          date: new Date().toISOString(),
          records,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      toast.success("Attendance submitted successfully!");
      startTransition(() => { router.push("/"); router.refresh(); });
    } catch {
      toast.error("Failed to submit attendance. Please try again.");
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">Take Attendance</h1>
            <p className="text-[10px] text-muted-foreground">
              {teacher.assignedClass?.name} · Section {teacher.assignedSection?.name} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-violet-600">{marked}/{students.length}</p>
            <p className="text-[10px] text-muted-foreground">marked</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-violet-600 rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 mt-2">
          <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" />
            <span className="text-[11px] font-semibold">{presentCount} Present</span>
          </div>
          <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full">
            <XCircle className="w-3 h-3" />
            <span className="text-[11px] font-semibold">{marked - presentCount} Absent</span>
          </div>
        </div>
      </div>

      {/* Mark All buttons */}
      <div className="flex gap-2 px-4 py-3 border-b bg-muted/20">
        <button
          onClick={() => {
            const all: Record<string, Status> = {};
            students.forEach((s) => { all[s.id] = "PRESENT"; });
            setAttendance(all);
          }}
          className="flex-1 h-9 text-xs font-semibold rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors"
        >
          Mark All Present
        </button>
        <button
          onClick={() => {
            const all: Record<string, Status> = {};
            students.forEach((s) => { all[s.id] = "ABSENT"; });
            setAttendance(all);
          }}
          className="flex-1 h-9 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 transition-colors"
        >
          Mark All Absent
        </button>
      </div>

      {/* Student list */}
      <div className="divide-y">
        {students.map((student, i) => {
          const status = attendance[student.id];
          return (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0, transition: { delay: i * 0.02 } }}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                status === "ABSENT" ? "bg-red-50/50 dark:bg-red-950/20" : ""
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                status === "PRESENT" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                status === "ABSENT" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{student.name}</p>
                <p className="text-[10px] text-muted-foreground">Roll #{student.rollNumber}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggle(student.id, "PRESENT")}
                  className={`w-12 h-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    status === "PRESENT"
                      ? "bg-green-500 text-white shadow-sm shadow-green-200 dark:shadow-green-900"
                      : "bg-muted text-muted-foreground hover:bg-green-50 dark:hover:bg-green-900/20"
                  }`}
                >
                  P
                </button>
                <button
                  onClick={() => toggle(student.id, "ABSENT")}
                  className={`w-12 h-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    status === "ABSENT"
                      ? "bg-red-500 text-white shadow-sm shadow-red-200 dark:shadow-red-900"
                      : "bg-muted text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20"
                  }`}
                >
                  A
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Submit button */}
      <div className="sticky bottom-20 px-4 py-4 bg-gradient-to-t from-background via-background/90 to-transparent">
        <button
          onClick={handleSubmit}
          disabled={isPending || marked < students.length}
          className="w-full h-13 py-3.5 bg-violet-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-violet-700 transition-colors active:scale-[0.98] shadow-lg shadow-violet-200 dark:shadow-violet-900/50"
        >
          {isPending ? (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isPending ? "Submitting..." : `Submit Attendance (${presentCount} Present)`}
        </button>
        {marked < students.length && (
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            {students.length - marked} student(s) not marked yet
          </p>
        )}
      </div>
    </div>
  );
}
