"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, BookOpen, CalendarDays, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls, selectCls, textareaCls } from "@/components/ui/form-field";
import { createAssignment, updateAssignment, deleteAssignment } from "@/lib/actions/assignments";

const Schema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

type FormData = z.infer<typeof Schema>;

interface Props {
  assignments: any[];
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
  currentUserId: string;
  userRole: string;
}

export function AssignmentsContent({ assignments, classes, currentUserId, userRole }: Readonly<Props>) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"closed" | "create" | "edit">("closed");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole);
  const canManage = (assignment: any) => isAdmin || assignment.teacher?.userId === currentUserId;

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  });

  const selectedClassId = watch("classId");
  const sections = classes.find((c) => c.id === selectedClassId)?.sections ?? [];

  const openCreate = () => {
    reset({ title: "", description: "", classId: "", sectionId: "", dueDate: "" });
    setEditTarget(null);
    setDialog("create");
  };

  const openEdit = (a: any) => {
    reset({
      title: a.title,
      description: a.description ?? "",
      classId: a.classId,
      sectionId: a.sectionId,
      dueDate: new Date(a.dueDate).toISOString().split("T")[0],
    });
    setEditTarget(a);
    setDialog("edit");
  };

  const onSubmit = async (data: FormData) => {
    const result = editTarget
      ? await updateAssignment(editTarget.id, data)
      : await createAssignment(data);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editTarget ? "Assignment updated" : "Assignment created");
    setDialog("closed");
    setEditTarget(null);
    router.refresh();
  };

  const handleDelete = async () => {
    const result = await deleteAssignment(deleteTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Assignment deleted"); router.refresh(); }
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-muted-foreground text-sm mt-1">{assignments.length} assignments</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence initial={false}>
          {assignments.map((a, i) => {
            const overdue = isOverdue(a.dueDate);
            const owned = canManage(a);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  {owned && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Edit assignment"
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete assignment"
                        onClick={() => setDeleteTarget(a)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-semibold mb-1">{a.title}</h3>
                {a.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{a.description}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 px-2 py-0.5 rounded-full font-medium">
                    {a.class?.name} · {a.section?.name}
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    overdue
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                      : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                  }`}>
                    <CalendarDays className="w-2.5 h-2.5" />
                    Due {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {overdue && " · Overdue"}
                  </span>
                </div>

                {a.teacher?.name && (
                  <p className="text-[10px] text-muted-foreground mt-2">By {a.teacher.name}</p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {assignments.length === 0 && (
          <div className="col-span-full h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <BookOpen className="w-8 h-8 opacity-30" />
            <p className="text-xs">No assignments yet</p>
          </div>
        )}
      </div>

      <Dialog
        open={dialog !== "closed"}
        onOpenChange={(open) => { if (!open) { setDialog("closed"); setEditTarget(null); } }}
        title={editTarget ? "Edit Assignment" : "Create Assignment"}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Title" error={errors.title?.message} required>
            <input {...register("title")} className={inputCls} placeholder="e.g. Chapter 5 — Newton's Laws" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Class" error={errors.classId?.message} required>
              <select {...register("classId")} className={selectCls}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Section" error={errors.sectionId?.message} required>
              <select {...register("sectionId")} className={selectCls} disabled={!selectedClassId}>
                <option value="">Select section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Due Date" error={errors.dueDate?.message} required>
            <input {...register("dueDate")} type="date" className={inputCls} />
          </FormField>
          <FormField label="Description">
            <textarea {...register("description")} rows={3} className={textareaCls} placeholder="Assignment details, instructions..." />
          </FormField>
          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setDialog("closed")} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editTarget ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Assignment"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
