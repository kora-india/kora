"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls, selectCls, textareaCls } from "@/components/ui/form-field";
import { createNotice, updateNotice, deleteNotice, toggleNoticePublish } from "@/lib/actions/notices";

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  HIGH: { label: "High", dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  MEDIUM: { label: "Medium", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  LOW: { label: "Low", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800" },
};

const Schema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  targetClassId: z.string().optional(),
  isPublished: z.boolean().default(true),
});

type FormData = z.infer<typeof Schema>;

interface Props {
  notices: any[];
  classes: { id: string; name: string }[];
  currentUserId: string;
  userRole: string;
}

export function NoticesContent({ notices, classes, currentUserId, userRole }: Readonly<Props>) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"closed" | "create" | "edit">("closed");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const canEdit = (notice: any) =>
    ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole) || notice.publishedById === currentUserId;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { priority: "MEDIUM", isPublished: true },
  });

  const openCreate = () => {
    reset({ title: "", content: "", priority: "MEDIUM", isPublished: true, targetClassId: "" });
    setEditTarget(null);
    setDialog("create");
  };

  const openEdit = (notice: any) => {
    reset({
      title: notice.title,
      content: notice.content,
      priority: notice.priority,
      isPublished: notice.isPublished,
      targetClassId: notice.targetClassId ?? "",
    });
    setEditTarget(notice);
    setDialog("edit");
  };

  const onSubmit = async (data: FormData) => {
    const payload = { ...data, targetClassId: data.targetClassId || undefined };
    const result = editTarget
      ? await updateNotice(editTarget.id, payload)
      : await createNotice(payload);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editTarget ? "Notice updated" : "Notice published");
    setDialog("closed");
    setEditTarget(null);
    router.refresh();
  };

  const handleDelete = async () => {
    const result = await deleteNotice(deleteTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Notice deleted"); router.refresh(); }
  };

  const handleTogglePublish = async (notice: any) => {
    const result = await toggleNoticePublish(notice.id, !notice.isPublished);
    if (result.error) toast.error(result.error);
    else { toast.success(notice.isPublished ? "Notice unpublished" : "Notice published"); router.refresh(); }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notices</h1>
          <p className="text-muted-foreground text-sm mt-1">{notices.length} notices</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Publish Notice
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {notices.map((n, i) => {
            const cfg = PRIORITY_CONFIG[n.priority] ?? PRIORITY_CONFIG.MEDIUM;
            const owned = canEdit(n);
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow ${n.isPublished ? "" : "opacity-60"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">{n.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.content}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {!n.isPublished && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted text-muted-foreground">
                            Draft
                          </span>
                        )}
                        {owned && (
                          <>
                            <button
                              type="button"
                              aria-label={n.isPublished ? "Unpublish" : "Publish"}
                              onClick={() => handleTogglePublish(n)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                              {n.isPublished ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                            <button
                              type="button"
                              aria-label="Edit notice"
                              onClick={() => openEdit(n)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete notice"
                              onClick={() => setDeleteTarget(n)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>By {n.publishedBy?.name ?? "Admin"}</span>
                      <span>·</span>
                      <span>{new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {n.targetClassId && <><span>·</span><span>Targeted</span></>}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {notices.length === 0 && (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            No notices yet. Click "Publish Notice" to create one.
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialog !== "closed"}
        onOpenChange={(open) => { if (!open) { setDialog("closed"); setEditTarget(null); } }}
        title={editTarget ? "Edit Notice" : "Publish New Notice"}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Title" error={errors.title?.message} required>
            <input {...register("title")} className={inputCls} placeholder="Notice title..." />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Priority" error={errors.priority?.message} required>
              <select {...register("priority")} className={selectCls}>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </FormField>
            <FormField label="Target Class (optional)">
              <select {...register("targetClassId")} className={selectCls}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Content" error={errors.content?.message} required>
            <textarea {...register("content")} rows={4} className={textareaCls} placeholder="Notice content..." />
          </FormField>
          <div className="flex items-center gap-2">
            <input {...register("isPublished")} type="checkbox" id="isPublished" className="rounded" />
            <label htmlFor="isPublished" className="text-xs text-muted-foreground">Publish immediately</label>
          </div>
          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setDialog("closed")} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editTarget ? "Save Changes" : "Publish"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Notice"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
