"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, CloudOff, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  enqueue,
  findQueued,
  sendAttendance,
  type AttendancePayload,
} from "@/lib/attendance-queue";

interface AttendanceTakerProps {
  students: { id: string; name: string; rollNumber: string }[];
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  /** The school's today ("YYYY-MM-DD") when the page was made. */
  date: string;
  existingAttendance: Record<string, string>;
  canChangeSection: boolean;
}

/** PRESENT / ABSENT from this screen; LATE or EXCUSED set in the admin app are kept. */
type Status = string | null;

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
  });

/** Whether today is taken, waiting on this phone, or the page is old. */
function DayStatus({
  isStale,
  queued,
  savedCount,
  date,
}: Readonly<{
  isStale: boolean;
  queued: boolean;
  savedCount: number;
  date: string;
}>) {
  const warn =
    "text-xs rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-3 py-2";
  if (isStale) {
    return (
      <p className={warn}>
        This page is from {dayLabel(date)}. Reconnect and reopen it to take
        today&apos;s attendance.
      </p>
    );
  }
  if (queued) {
    return (
      <p className={`${warn} flex items-center gap-1.5`}>
        <CloudOff className="w-3.5 h-3.5 shrink-0" />
        Saved on this phone, waiting to be sent.
      </p>
    );
  }
  if (savedCount > 0) {
    return (
      <p className="text-xs rounded-xl bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300 px-3 py-2">
        Already taken today for {savedCount} student
        {savedCount === 1 ? "" : "s"}. Saving again updates it.
      </p>
    );
  }
  return (
    <p className="text-xs rounded-xl bg-muted px-3 py-2 text-muted-foreground">
      Not taken yet today. Tap P or A for each student.
    </p>
  );
}

export function AttendanceTaker({
  students,
  classId,
  sectionId,
  className,
  sectionName,
  date,
  existingAttendance,
  canChangeSection,
}: Readonly<AttendanceTakerProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);
  // U7: nobody starts as Present; a day already taken shows what was saved.
  const [attendance, setAttendance] = useState<Record<string, Status>>(() => {
    const init: Record<string, Status> = {};
    students.forEach((s) => {
      init[s.id] = existingAttendance[s.id] ?? null;
    });
    return init;
  });
  const savedCount = Object.keys(existingAttendance).length;
  const [queuedHere, setQueuedHere] = useState(false);
  // A page kept for offline use may be from an earlier day.
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    setIsStale(new Date().toLocaleDateString("en-CA") > date);
    const queued = findQueued({ classId, sectionId, date });
    if (queued) {
      setQueuedHere(true);
      setAttendance((prev) => {
        const next = { ...prev };
        queued.records.forEach((r) => {
          next[r.studentId] = r.status;
        });
        return next;
      });
    }
  }, [classId, sectionId, date]);

  const label = `${className} – ${sectionName} · ${dayLabel(date)}`;
  const statuses = Object.values(attendance);
  const marked = statuses.filter(Boolean).length;
  const presentCount = statuses.filter((s) => s === "PRESENT").length;
  const absentCount = statuses.filter((s) => s === "ABSENT").length;
  const pct =
    students.length > 0 ? Math.round((marked / students.length) * 100) : 0;

  const toggle = (studentId: string, status: Status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };
  const markAll = (status: Status) => {
    const all: Record<string, Status> = {};
    students.forEach((s) => {
      all[s.id] = status;
    });
    setAttendance(all);
  };

  const handleSubmit = async () => {
    const payload: AttendancePayload = {
      classId,
      sectionId,
      date,
      records: Object.entries(attendance)
        .filter(([, status]) => status)
        .map(([studentId, status]) => ({ studentId, status: status! })),
    };
    const keepForLater = (reason: string) => {
      enqueue({ ...payload, label, queuedAt: Date.now() });
      setQueuedHere(true);
      toast.message(
        `${reason} Saved on this phone; it will be sent automatically.`,
      );
    };

    if (!navigator.onLine) {
      keepForLater("You're offline.");
      return;
    }
    setIsSending(true);
    const result = await sendAttendance(payload);
    setIsSending(false);
    if (result.ok) {
      toast.success("Attendance saved");
      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    } else if (result.retry) {
      keepForLater("Couldn't reach the server.");
    } else {
      toast.error(result.error);
    }
  };

  const busy = isPending || isSending;

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={canChangeSection ? "/attendance/take" : "/"}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">Take Attendance</h1>
            <p className="text-[10px] text-muted-foreground">
              {className} · Section {sectionName} · {dayLabel(date)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-violet-600">
              {marked}/{students.length}
            </p>
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
            <span className="text-[11px] font-semibold">
              {presentCount} Present
            </span>
          </div>
          <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full">
            <XCircle className="w-3 h-3" />
            <span className="text-[11px] font-semibold">
              {absentCount} Absent
            </span>
          </div>
        </div>
      </div>

      {/* Whether today is already taken */}
      <div className="px-4 pt-3 space-y-2">
        <DayStatus
          isStale={isStale}
          queued={queuedHere}
          savedCount={savedCount}
          date={date}
        />
      </div>

      {/* Mark All buttons */}
      <div className="flex gap-2 px-4 py-3 border-b bg-muted/20">
        <button
          onClick={() => markAll("PRESENT")}
          className="flex-1 h-9 text-xs font-semibold rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors"
        >
          Mark All Present
        </button>
        <button
          onClick={() => markAll(null)}
          className="flex-1 h-9 text-xs font-semibold rounded-xl bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
        >
          Clear All
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
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  status === "PRESENT"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : status === "ABSENT"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {student.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{student.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Roll #{student.rollNumber}
                  {status && status !== "PRESENT" && status !== "ABSENT"
                    ? ` · ${status.toLowerCase()}`
                    : ""}
                  {!status ? " · not marked" : ""}
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggle(student.id, "PRESENT")}
                  aria-pressed={status === "PRESENT"}
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
                  aria-pressed={status === "ABSENT"}
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
          disabled={busy || isStale || marked < students.length}
          className="w-full h-13 py-3.5 bg-violet-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-violet-700 transition-colors active:scale-[0.98] shadow-lg shadow-violet-200 dark:shadow-violet-900/50"
        >
          {busy ? (
            <svg
              aria-hidden="true"
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <Send className="w-4 h-4" />
          )}
          {busy
            ? "Saving..."
            : `${savedCount > 0 ? "Update" : "Save"} Attendance (${presentCount} Present, ${absentCount} Absent)`}
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
