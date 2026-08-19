"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, MoreVertical, Users } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { StudentDialog } from "./student-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteStudent } from "@/lib/actions/students";

const FEE_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
};

interface Props {
  students: any[];
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
  canEdit: boolean;
}

const PAGE_SIZE = 20;

export function StudentsContent({ students, classes, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<"closed" | "create" | "edit">("closed");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      s.rollNumber.includes(q) ||
      s.admissionNumber.includes(q);
    const matchClass = !selectedClass || s.classId === selectedClass;
    return matchSearch && matchClass;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = (student: any) => {
    setEditTarget(student);
    setDialog("edit");
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    const result = await deleteStudent(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Student removed");
      router.refresh();
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">{students.length} students enrolled</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog("create")}
            className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label="Search students"
            placeholder="Search by name, roll, admission..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          aria-label="Filter by class"
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
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
              {canEdit && <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: i * 0.02 } }}
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
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${FEE_BADGE[s.feeCharges?.[0]?.status] ?? FEE_BADGE.PAID}`}>
                    {s.feeCharges?.[0]?.status ?? "NO DUES"}
                  </span>
                </td>
                {canEdit && (
                  <td className="h-12 px-4">
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Student actions"
                        onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === s.id && (
                        <div className="absolute right-0 top-full mt-1 z-10 w-36 rounded-xl border bg-card shadow-lg py-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(s)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(s); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5}>
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Users className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-sm font-semibold mb-1">
                      {search || selectedClass ? "No students match your filters" : "No students yet"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      {search || selectedClass
                        ? "Try adjusting your search or filter to find what you're looking for."
                        : "Add your first student to get started tracking enrollment."}
                    </p>
                    {(search || selectedClass) ? (
                      <button
                        type="button"
                        onClick={() => { setSearch(""); setSelectedClass(""); }}
                        className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors"
                      >
                        Clear filters
                      </button>
                    ) : canEdit && (
                      <button
                        type="button"
                        onClick={() => setDialog("create")}
                        className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Student
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs transition-colors ${p === page ? "bg-violet-600 text-white" : "hover:bg-muted"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <StudentDialog
        open={dialog !== "closed"}
        onOpenChange={(open) => { if (!open) { setDialog("closed"); setEditTarget(null); } }}
        student={editTarget}
        classes={classes}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove Student"
        description={`Are you sure you want to remove ${deleteTarget?.name}? This will deactivate their account but preserve historical records.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </div>
  );
}
