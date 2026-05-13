"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Search, Filter } from "lucide-react";
import { formatDate } from "@schoolos/utils";

interface StudentsContentProps {
  students: any[];
  classes: any[];
}

const FEE_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
};

export function StudentsContent({ students, classes }: StudentsContentProps) {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.includes(search) || s.admissionNumber.includes(search);
    const matchClass = !selectedClass || s.class?.name === selectedClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">{students.length} students enrolled</p>
        </div>
        <button className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search by name, roll, admission..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Admission No.</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Parent</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Fee Status</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                <td className="h-12 px-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
                      {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">Roll #{s.rollNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="h-12 px-4 text-xs text-muted-foreground">{s.admissionNumber}</td>
                <td className="h-12 px-4 text-xs">{s.class?.name} · {s.section?.name}</td>
                <td className="h-12 px-4">
                  <p className="text-xs font-medium">{s.parentName}</p>
                  <p className="text-[10px] text-muted-foreground">{s.parentPhone}</p>
                </td>
                <td className="h-12 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${FEE_BADGE[s.fees?.[0]?.status] ?? FEE_BADGE.PENDING}`}>
                    {s.fees?.[0]?.status ?? "PENDING"}
                  </span>
                </td>
                <td className="h-12 px-4">
                  <button className="text-xs text-violet-600 hover:underline">View</button>
                </td>
              </motion.tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="h-32 text-center text-xs text-muted-foreground">No students found</td></tr>
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
