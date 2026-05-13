"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, MoreVertical, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { TeacherDialog } from "./teacher-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTeacher } from "@/lib/actions/teachers";

interface Props {
  teachers: any[];
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
}

export function TeachersContent({ teachers, classes }: Readonly<Props>) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"closed" | "create" | "edit">("closed");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    const result = await deleteTeacher(deleteTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Teacher removed"); router.refresh(); }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="text-muted-foreground text-sm mt-1">{teachers.length} teaching staff</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog("create")}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          aria-label="Search teachers"
          placeholder="Search by name, subject, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
            className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                  {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.subject}</p>
                </div>
              </div>
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  aria-label="Teacher actions"
                  onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {openMenuId === t.id && (
                  <div className="absolute right-0 top-full mt-1 z-10 w-36 rounded-xl border bg-card shadow-lg py-1">
                    <button
                      type="button"
                      onClick={() => { setEditTarget(t); setDialog("edit"); setOpenMenuId(null); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteTarget(t); setOpenMenuId(null); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground truncate mb-2">{t.email}</p>

            {t.assignedClass?.name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800">
                <GraduationCap className="w-2.5 h-2.5" />
                {t.assignedClass.name} · {t.assignedSection?.name ?? "—"}
              </span>
            )}
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <GraduationCap className="w-6 h-6 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm font-semibold mb-1">
              {search ? "No teachers match your search" : "No teachers yet"}
            </p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">
              {search
                ? "Try a different name, subject, or email."
                : "Add your first teacher to get started."}
            </p>
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors"
              >
                Clear search
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDialog("create")}
                className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Teacher
              </button>
            )}
          </div>
        )}
      </div>

      <TeacherDialog
        open={dialog !== "closed"}
        onOpenChange={(open) => { if (!open) { setDialog("closed"); setEditTarget(null); } }}
        teacher={editTarget}
        classes={classes}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove Teacher"
        description={`Remove ${deleteTarget?.name}? Their login will be deactivated. Existing records are preserved.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </div>
  );
}
