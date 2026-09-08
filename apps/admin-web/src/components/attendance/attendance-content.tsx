"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryState } from "@/hooks/use-query-state";
import {
  markAttendance,
  getAttendanceForClass,
} from "@/lib/actions/attendance";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface Student {
  id: string;
  name: string;
  rollNumber: string;
}
interface ClassData {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
interface TodayRecord {
  classId: string;
  status: string;
  _count: { id: number };
}

interface Props {
  classes: ClassData[];
  todayRecords: TodayRecord[];
  weeklyAttendance?: {
    day: string;
    present: number;
    absent: number;
    total: number;
  }[];
  userRole: string;
  userId: string;
  assignedClassId?: string | null;
  assignedSectionId?: string | null;
  assignedClassIds?: string[];
  assignedSectionIds?: string[];
}

const STATUS_CONFIG = {
  PRESENT: {
    label: "Present",
    color: "bg-green-500 text-white border-green-500",
    icon: CheckCircle,
  },
  ABSENT: {
    label: "Absent",
    color: "bg-red-500 text-white border-red-500",
    icon: XCircle,
  },
  LATE: {
    label: "Late",
    color: "bg-amber-500 text-white border-amber-500",
    icon: Clock,
  },
  EXCUSED: {
    label: "Excused",
    color: "bg-blue-500 text-white border-blue-500",
    icon: AlertCircle,
  },
};

export function AttendanceContent({
  classes,
  todayRecords,
  weeklyAttendance = [],
  userRole,
  assignedClassId,
  assignedSectionId,
  assignedClassIds = [],
  assignedSectionIds = [],
}: Readonly<Props>) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [selectedClassId, setSelectedClassId] = useQueryState(
    "classId",
    assignedClassId ?? (classes[0]?.id || ""),
  );
  const [selectedSectionId, setSelectedSectionId] = useQueryState(
    "sectionId",
    assignedSectionId ?? "",
  );
  const [selectedDate, setSelectedDate] = useQueryState("date", today);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTeacher = userRole === "TEACHER";
  const teacherClassIds =
    assignedClassIds.length > 0
      ? assignedClassIds
      : assignedClassId
        ? [assignedClassId]
        : [];

  const availableClasses =
    isTeacher && teacherClassIds.length > 0
      ? classes.filter((c) => teacherClassIds.includes(c.id))
      : classes;

  const teacherSecIds =
    assignedSectionIds.length > 0
      ? assignedSectionIds
      : assignedSectionId
        ? [assignedSectionId]
        : [];

  const allSectionsForClass =
    classes.find((c) => c.id === selectedClassId)?.sections ?? [];
  const sections =
    isTeacher && teacherSecIds.length > 0
      ? allSectionsForClass.filter((s) => teacherSecIds.includes(s.id))
      : allSectionsForClass;

  const totalPresent = todayRecords
    .filter((r) => r.status === "PRESENT")
    .reduce((a, r) => a + r._count.id, 0);
  const totalAbsent = todayRecords
    .filter((r) => r.status === "ABSENT")
    .reduce((a, r) => a + r._count.id, 0);
  const totalLate = todayRecords
    .filter((r) => r.status === "LATE")
    .reduce((a, r) => a + r._count.id, 0);
  const totalExcused = todayRecords
    .filter((r) => r.status === "EXCUSED")
    .reduce((a, r) => a + r._count.id, 0);
  const total = totalPresent + totalAbsent + totalLate + totalExcused;
  const pct =
    total > 0 ? Math.round(((totalPresent + totalLate) / total) * 100) : 0;

  const loadStudents = async () => {
    if (!selectedClassId || !selectedSectionId) {
      toast.error("Select a class and section first");
      return;
    }
    setLoadingStudents(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch(
          `/api/students?classId=${selectedClassId}&sectionId=${selectedSectionId}`,
        ),
        getAttendanceForClass(selectedClassId, selectedSectionId, selectedDate),
      ]);

      const data = await studentsRes.json();
      const list: Student[] = data.students ?? [];
      setStudents(list);

      const defaults: Record<string, AttendanceStatus> = {};

      // Default everyone to present
      list.forEach((s) => {
        defaults[s.id] = "PRESENT";
      });

      // Override with existing records from DB if they exist
      if (attendanceRes.success && attendanceRes.records) {
        attendanceRes.records.forEach((record: any) => {
          if (defaults[record.studentId]) {
            defaults[record.studentId] = record.status as AttendanceStatus;
          }
        });
      }

      setAttendance(defaults);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    setAttendance(Object.fromEntries(students.map((s) => [s.id, status])));
  };

  const saveAttendance = async () => {
    if (students.length === 0) {
      toast.error("Load students first");
      return;
    }
    setSaving(true);
    const records = students.map((s) => ({
      studentId: s.id,
      status: attendance[s.id] ?? "PRESENT",
    }));
    const result = await markAttendance({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      date: selectedDate,
      records,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Attendance saved for ${result.count} students`);
    router.refresh();
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Mark and track student attendance
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Today's Rate",
            value: `${pct || "—"}%`,
            icon: Calendar,
            color:
              "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
          },
          {
            label: "Present Today",
            value: (totalPresent || "—").toString(),
            icon: CheckCircle,
            color:
              "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
          },
          {
            label: "Absent Today",
            value: (totalAbsent || "—").toString(),
            icon: XCircle,
            color:
              "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
          },
          {
            label: "Classes Today",
            value: classes.length.toString(),
            icon: Users,
            color:
              "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-5"
          >
            <div className={`p-2 rounded-lg w-fit mb-3 ${card.color}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Mark Attendance Panel */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold">Mark Attendance</h3>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              aria-label="Attendance date"
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 px-2 rounded-lg border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              aria-label="Select class"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSectionId("");
                setStudents([]);
              }}
              disabled={isTeacher && availableClasses.length === 1}
              className="h-8 px-2 rounded-lg border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select class</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Select section"
              value={selectedSectionId}
              onChange={(e) => {
                setSelectedSectionId(e.target.value);
                setStudents([]);
              }}
              disabled={
                !selectedClassId || (isTeacher && sections.length === 1)
              }
              className="h-8 px-2 rounded-lg border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadStudents}
              disabled={loadingStudents}
              className="h-8 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {loadingStudents ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : null}
              Load Students
            </button>
          </div>
        </div>

        {students.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
              <span className="text-xs text-muted-foreground mr-1">
                Mark all:
              </span>
              {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => markAll(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-medium border transition-colors ${STATUS_CONFIG[s].color}`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                {students.length} students
              </span>
            </div>

            <div className="divide-y max-h-96 overflow-y-auto">
              {students.map((student) => {
                const status = attendance[student.id] ?? "PRESENT";
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[9px] font-bold text-violet-700 dark:text-violet-300">
                        {student.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{student.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Roll #{student.rollNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(
                        (s) => (
                          <button
                            key={s}
                            type="button"
                            title={STATUS_CONFIG[s].label}
                            onClick={() =>
                              setAttendance((prev) => ({
                                ...prev,
                                [student.id]: s,
                              }))
                            }
                            className={`w-7 h-7 rounded-lg text-[9px] font-bold border-2 transition-all ${
                              status === s
                                ? STATUS_CONFIG[s].color
                                : "border-border text-muted-foreground hover:border-muted-foreground"
                            }`}
                          >
                            {s[0]}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t flex justify-end">
              <button
                type="button"
                onClick={saveAttendance}
                disabled={saving}
                className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Attendance
              </button>
            </div>
          </>
        )}

        {students.length === 0 && !loadingStudents && (
          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
            Select a class and section, then click "Load Students" to mark
            attendance
          </div>
        )}
      </div>

      {/* Weekly chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Weekly Attendance Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyAttendance}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="present"
              name="Present"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="absent"
              name="Absent"
              fill="#f87171"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
