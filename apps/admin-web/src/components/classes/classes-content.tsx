"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, BookOpen, Loader2, Award } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Select } from "antd";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import { createClass, updateClass, deleteClass, createSection, deleteSection } from "@/lib/actions/classes";

const ClassSchema = z.object({
  name: z.string().min(1, "Required"),
  grade: z.coerce.number().min(1).max(13),
  classTeacherId: z.string().optional().nullable(),
});
const SectionSchema = z.object({
  name: z.string().min(1, "Required"),
});

type ClassForm = z.infer<typeof ClassSchema>;
type SectionForm = z.infer<typeof SectionSchema>;

interface Props {
  classes: any[];
  teachers?: any[];
}

export function ClassesContent({ classes, teachers = [] }: Readonly<Props>) {
  const router = useRouter();
  const [classDialog, setClassDialog] = useState<"closed" | "create" | "edit">("closed");
  const [sectionDialog, setSectionDialog] = useState<string | null>(null);
  const [editClass, setEditClass] = useState<any>(null);
  const [deleteClassTarget, setDeleteClassTarget] = useState<any>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<any>(null);
  const [selectedClassTeacherId, setSelectedClassTeacherId] = useState<string | null>(null);

  const classForm = useForm<ClassForm>({ resolver: zodResolver(ClassSchema) });
  const sectionForm = useForm<SectionForm>({ resolver: zodResolver(SectionSchema) });

  const onSubmitClass = async (data: ClassForm) => {
    const payload = {
      ...data,
      classTeacherId: selectedClassTeacherId || null,
    };
    const result = editClass
      ? await updateClass(editClass.id, payload)
      : await createClass(payload);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editClass ? "Class updated" : "Class created");
    setClassDialog("closed");
    setEditClass(null);
    setSelectedClassTeacherId(null);
    classForm.reset();
    router.refresh();
  };

  const onSubmitSection = async (data: SectionForm) => {
    if (!sectionDialog) return;
    const result = await createSection({ classId: sectionDialog, name: data.name });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Section added");
    setSectionDialog(null);
    sectionForm.reset();
    router.refresh();
  };

  const handleDeleteClass = async () => {
    const result = await deleteClass(deleteClassTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Class deleted"); router.refresh(); }
  };

  const handleDeleteSection = async () => {
    const result = await deleteSection(deleteSectionTarget.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Section deleted"); router.refresh(); }
  };

  const openEditClass = (cls: any) => {
    setEditClass(cls);
    setSelectedClassTeacherId(cls.classTeacherId ?? null);
    classForm.reset({ name: cls.name, grade: cls.grade, classTeacherId: cls.classTeacherId ?? "" });
    setClassDialog("edit");
  };

  const openCreateClass = () => {
    setEditClass(null);
    setSelectedClassTeacherId(null);
    classForm.reset({ name: "", grade: 1, classTeacherId: "" });
    setClassDialog("create");
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classes & Sections</h1>
          <p className="text-muted-foreground text-sm mt-1">{classes.length} classes configured</p>
        </div>
        <button
          type="button"
          onClick={openCreateClass}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {classes.map((cls, i) => (
          <motion.div
            key={cls.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
            className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300 text-sm flex-shrink-0">
                  {cls.grade}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Edit class"
                    onClick={() => openEditClass(cls)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete class"
                    onClick={() => setDeleteClassTarget(cls)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-semibold">{cls.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cls._count?.students ?? 0} students</p>

              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>
                  Class Teacher:{" "}
                  {cls.classTeacher?.name ? (
                    <strong className="text-foreground font-medium">{cls.classTeacher.name}</strong>
                  ) : (
                    <span className="italic text-muted-foreground/80">Unassigned</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex gap-1.5 mt-4 flex-wrap pt-3 border-t">
              {cls.sections.map((s: any) => (
                <div key={s.id} className="group flex items-center gap-1">
                  <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 px-2 py-0.5 rounded-full font-medium">
                    {s.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete section ${s.name}`}
                    onClick={() => setDeleteSectionTarget(s)}
                    className="hidden group-hover:flex w-3.5 h-3.5 rounded-full bg-red-100 text-red-600 items-center justify-center"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { sectionForm.reset({ name: "" }); setSectionDialog(cls.id); }}
                className="text-[10px] px-2 py-0.5 rounded-full border border-dashed text-muted-foreground hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center gap-1"
              >
                <Plus className="w-2.5 h-2.5" /> Section
              </button>
            </div>
          </motion.div>
        ))}

        {classes.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm font-semibold mb-1">No classes yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">
              Create your first class to start organizing students and sections.
            </p>
            <button
              type="button"
              onClick={openCreateClass}
              className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Class
            </button>
          </div>
        )}
      </div>

      {/* Class Dialog */}
      <Dialog
        open={classDialog !== "closed"}
        onOpenChange={(open) => { if (!open) { setClassDialog("closed"); setEditClass(null); } }}
        title={editClass ? "Edit Class" : "Create New Class"}
        className="max-w-md"
      >
        <form onSubmit={classForm.handleSubmit(onSubmitClass)} className="space-y-4">
          <FormField label="Class Name" error={classForm.formState.errors.name?.message} required>
            <input {...classForm.register("name")} className={inputCls} placeholder="e.g. Grade 8" />
          </FormField>
          <FormField label="Grade (1–13)" error={classForm.formState.errors.grade?.message} required>
            <input {...classForm.register("grade")} type="number" min={1} max={13} className={inputCls} />
          </FormField>
          <FormField label="Class Teacher (Optional)">
            <Select
              allowClear
              placeholder="Select Class Teacher"
              value={selectedClassTeacherId || undefined}
              onChange={(val) => {
                setSelectedClassTeacherId(val || null);
                classForm.setValue("classTeacherId", val || "");
              }}
              options={teachers.map((t) => ({
                label: `${t.name} (${t.email})`,
                value: t.id,
              }))}
              getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
              dropdownStyle={{ maxHeight: 260, overflowY: "auto" }}
              virtual={false}
              className="w-full"
              style={{ width: "100%" }}
              size="large"
              dropdownRender={(menu) => (
                <div
                  onWheel={(e) => e.stopPropagation()}
                  style={{ maxHeight: 260, overflowY: "auto" }}
                >
                  {menu}
                </div>
              )}
            />
          </FormField>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => setClassDialog("closed")} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={classForm.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {classForm.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editClass ? "Save Changes" : "Create Class"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Section Dialog */}
      <Dialog
        open={!!sectionDialog}
        onOpenChange={(open) => { if (!open) setSectionDialog(null); }}
        title="Add Section"
        description="Add a new section to this class"
        className="max-w-sm"
      >
        <form onSubmit={sectionForm.handleSubmit(onSubmitSection)} className="space-y-4">
          <FormField label="Section Name" error={sectionForm.formState.errors.name?.message} required>
            <input {...sectionForm.register("name")} className={inputCls} placeholder="e.g. A" />
          </FormField>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setSectionDialog(null)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={sectionForm.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {sectionForm.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Section
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteClassTarget}
        onOpenChange={(open) => { if (!open) setDeleteClassTarget(null); }}
        title="Delete Class"
        description={`Delete "${deleteClassTarget?.name}"? This will also remove all its sections. Students must be moved first.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteClass}
      />

      <ConfirmDialog
        open={!!deleteSectionTarget}
        onOpenChange={(open) => { if (!open) setDeleteSectionTarget(null); }}
        title="Delete Section"
        description={`Delete section "${deleteSectionTarget?.name}"? Students in this section must be reassigned first.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteSection}
      />
    </div>
  );
}
