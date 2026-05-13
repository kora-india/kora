"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Edit, Eye, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { getFeeStatusLabel } from "@schoolos/utils";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  parentPhone: string;
  section: { name: string; class: { name: string } };
  fees: Array<{ status: string; amount: any }>;
}

interface StudentsTableProps {
  students: Student[];
  canEdit?: boolean;
}

const feeStatusClasses: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
};

export function StudentsTable({ students, canEdit = false }: StudentsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="card-elevated overflow-hidden">
      <div className="p-4 border-b border-border">
        <input
          type="text"
          placeholder="Search by name or roll number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 text-sm bg-muted/50 border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Class / Section</th>
              <th className="px-4 py-3 text-left">Roll No.</th>
              <th className="px-4 py-3 text-left">Parent Contact</th>
              <th className="px-4 py-3 text-left">Fee Status</th>
              {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((student, i) => {
              const feeStatus = student.fees[0]?.status ?? "PAID";
              return (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {student.firstName[0]}{student.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">
                          {student.firstName} {student.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {student.section.class.name} — {student.section.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {student.rollNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {student.parentPhone}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${feeStatusClasses[feeStatus] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {getFeeStatusLabel(feeStatus)}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/students/${student.id}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          href={`/students/${student.id}/edit`}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Edit size={14} />
                        </Link>
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3">📚</div>
            <div className="text-sm font-medium text-foreground">No students found</div>
            <div className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Add your first student to get started"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
