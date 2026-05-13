"use client";

import { useState } from "react";

interface AttendanceRecord {
  id: string;
  status: string;
  student: { firstName: string; lastName: string; rollNumber: string };
  section: { name: string; class: { name: string } };
  teacher: { firstName: string; lastName: string };
}

interface AttendanceTableProps {
  records: AttendanceRecord[];
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  PRESENT: { label: "Present", classes: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300" },
  ABSENT: { label: "Absent", classes: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300" },
  LATE: { label: "Late", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" },
  EXCUSED: { label: "Excused", classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" },
};

export function AttendanceTable({ records }: AttendanceTableProps) {
  const [filter, setFilter] = useState<string>("ALL");

  const filtered = filter === "ALL" ? records : records.filter((r) => r.status === filter);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        {["ALL", "PRESENT", "ABSENT", "LATE"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {s === "ALL" ? `All (${records.length})` : `${statusConfig[s].label} (${records.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Class</th>
              <th className="px-4 py-3 text-left">Roll</th>
              <th className="px-4 py-3 text-left">Marked By</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => {
              const cfg = statusConfig[record.status] ?? { label: record.status, classes: "bg-muted text-muted-foreground border-border" };
              return (
                <tr key={record.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                        {record.student.firstName[0]}{record.student.lastName[0]}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {record.student.firstName} {record.student.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {record.section.class.name} — {record.section.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {record.student.rollNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {record.teacher.firstName} {record.teacher.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.classes}`}>
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-medium text-foreground">No attendance records today</div>
            <div className="text-xs text-muted-foreground mt-1">
              Teachers can submit attendance from the Teacher PWA
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
