"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Loader2,
  Award,
  X,
  Check,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Select } from "antd";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import {
  updateClass,
  deleteClass,
  createSections,
  deleteSection,
} from "@/lib/actions/classes";
import {
  CLASS_NAME_MAX,
  DISPLAY_ORDER_MAX,
  DISPLAY_ORDER_MIN,
  classShortLabel,
} from "@/lib/class-catalog";
import { CreateClassDialog } from "@/components/classes/create-class/create-class-dialog";

// Edit form. Creation goes through <CreateClassDialog />.
const ClassSchema = z.object({
  name: z.string().trim().min(1, "Required").max(CLASS_NAME_MAX),
  grade: z.coerce
    .number()
    .int("Use a whole number")
    .min(DISPLAY_ORDER_MIN)
    .max(DISPLAY_ORDER_MAX),
  classTeacherId: z.string().optional().nullable(),
});

type ClassForm = z.infer<typeof ClassSchema>;

interface Props {
  classes: any[];
  teachers?: any[];
  academicYear?: string | null;
}

export function ClassesContent({
  classes,
  teachers = [],
  academicYear,
}: Readonly<Props>) {
  const router = useRouter();
  const [classDialog, setClassDialog] = useState<"closed" | "create" | "edit">(
    "closed",
  );
  const [sectionDialog, setSectionDialog] = useState<string | null>(null);
  const [editClass, setEditClass] = useState<any>(null);
  const [deleteClassTarget, setDeleteClassTarget] = useState<any>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<any>(null);
  const [selectedClassTeacherId, setSelectedClassTeacherId] = useState<
    string | null
  >(null);

  // Multiple sections state
  const [pendingSections, setPendingSections] = useState<string[]>([]);
  const [sectionInput, setSectionInput] = useState("");
  const [isSubmittingSections, setIsSubmittingSections] = useState(false);

  const targetClass = classes.find((c) => c.id === sectionDialog);

  const classForm = useForm<ClassForm>({ resolver: zodResolver(ClassSchema) });

  const onSubmitClass = async (data: ClassForm) => {
    if (!editClass) return;
    const result = await updateClass(editClass.id, {
      ...data,
      classTeacherId: selectedClassTeacherId || null,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Class updated");
    setClassDialog("closed");
    setEditClass(null);
    setSelectedClassTeacherId(null);
    classForm.reset();
    router.refresh();
  };

  const openAddSections = (cls: any) => {
    setSectionDialog(cls.id);
    setPendingSections([]);
    setSectionInput("");
  };

  const addSectionNames = (names: string[]) => {
    const newNames: string[] = [];
    const existingNames = new Set(
      (targetClass?.sections || []).map((s: any) => s.name.toUpperCase()),
    );
    const pendingSet = new Set(pendingSections.map((s) => s.toUpperCase()));

    for (const n of names) {
      const trimmed = n.trim();
      if (!trimmed) continue;
      const upper = trimmed.toUpperCase();
      if (existingNames.has(upper)) {
        toast.info(
          `Section "${trimmed}" already exists in ${targetClass?.name}`,
        );
        continue;
      }
      if (pendingSet.has(upper)) continue;
      pendingSet.add(upper);
      newNames.push(trimmed);
    }

    if (newNames.length > 0) {
      setPendingSections((prev) => [...prev, ...newNames]);
    }
  };

  const handleAddFromInput = () => {
    if (!sectionInput.trim()) return;
    const parts = sectionInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    addSectionNames(parts);
    setSectionInput("");
  };

  const removePendingSection = (name: string) => {
    setPendingSections((prev) =>
      prev.filter((s) => s.toUpperCase() !== name.toUpperCase()),
    );
  };

  const onSubmitSections = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sectionDialog) return;

    const allToAdd = [...pendingSections];
    if (sectionInput.trim()) {
      const inputParts = sectionInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const existingNames = new Set(
        (targetClass?.sections || []).map((s: any) => s.name.toUpperCase()),
      );
      const currentSet = new Set(allToAdd.map((s) => s.toUpperCase()));
      for (const p of inputParts) {
        if (
          !existingNames.has(p.toUpperCase()) &&
          !currentSet.has(p.toUpperCase())
        ) {
          currentSet.add(p.toUpperCase());
          allToAdd.push(p);
        }
      }
    }

    if (allToAdd.length === 0) {
      toast.error("Please add at least one section name");
      return;
    }

    setIsSubmittingSections(true);
    try {
      const result = await createSections({
        classId: sectionDialog,
        names: allToAdd,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.skipped && result.skipped.length > 0) {
        toast.success(
          `Added ${result.count} section(s). ${result.skipped.join(", ")} already existed.`,
        );
      } else {
        toast.success(
          `Added ${result.count} section(s): ${result.created?.join(", ") ?? ""}`,
        );
      }

      setSectionDialog(null);
      setPendingSections([]);
      setSectionInput("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to add sections");
    } finally {
      setIsSubmittingSections(false);
    }
  };

  const handleDeleteClass = async () => {
    const result = await deleteClass(deleteClassTarget.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Class deleted");
      router.refresh();
    }
  };

  const handleDeleteSection = async () => {
    const result = await deleteSection(deleteSectionTarget.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Section deleted");
      router.refresh();
    }
  };

  const openEditClass = (cls: any) => {
    setEditClass(cls);
    setSelectedClassTeacherId(cls.classTeacherId ?? null);
    classForm.reset({
      name: cls.name,
      grade: cls.grade,
      classTeacherId: cls.classTeacherId ?? "",
    });
    setClassDialog("edit");
  };

  const openCreateClass = () => {
    setEditClass(null);
    setClassDialog("create");
  };

  return (
    <div className="p-6 space-y-5 w-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classes & Sections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {classes.length} classes configured
          </p>
        </div>
        <button
          id="tour-classes-add-btn"
          type="button"
          onClick={openCreateClass}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      <div
        id="tour-classes-grid"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
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
                  {classShortLabel(cls.name)}
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

              <p className="text-sm font-semibold truncate" title={cls.name}>
                {cls.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cls._count?.students ?? 0} students
              </p>

              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>
                  Class Teacher:{" "}
                  {cls.classTeacher?.name ? (
                    <strong className="text-foreground font-medium">
                      {cls.classTeacher.name}
                    </strong>
                  ) : (
                    <span className="italic text-muted-foreground/80">
                      Unassigned
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div
              id={i === 0 ? "tour-classes-sections" : undefined}
              className="flex gap-1.5 mt-4 flex-wrap pt-3 border-t"
            >
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
                onClick={() => openAddSections(cls)}
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

      <CreateClassDialog
        open={classDialog === "create"}
        onOpenChange={(open) => {
          if (!open) setClassDialog("closed");
        }}
        classes={classes}
        teachers={teachers}
        academicYear={academicYear}
        onManageSections={(classId) => {
          const cls = classes.find((c) => c.id === classId);
          setClassDialog("closed");
          if (cls) openAddSections(cls);
        }}
        onCreated={() => {
          setClassDialog("closed");
          router.refresh();
        }}
      />

      {/* Edit Class Dialog */}
      <Dialog
        open={classDialog === "edit"}
        onOpenChange={(open) => {
          if (!open) {
            setClassDialog("closed");
            setEditClass(null);
          }
        }}
        title="Edit Class"
        className="max-w-md"
      >
        <form
          onSubmit={classForm.handleSubmit(onSubmitClass)}
          className="space-y-4"
        >
          <FormField
            label="Class Name"
            error={classForm.formState.errors.name?.message}
            required
          >
            <input
              {...classForm.register("name")}
              className={inputCls}
              placeholder="e.g. Grade 8"
            />
          </FormField>
          <FormField
            label="Display Order"
            error={classForm.formState.errors.grade?.message}
            required
          >
            <input
              {...classForm.register("grade")}
              type="number"
              step={1}
              min={DISPLAY_ORDER_MIN}
              max={DISPLAY_ORDER_MAX}
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground">
              Controls sort order. Nursery −2, LKG −1, UKG 0, Grade N = N.
            </p>
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
              getPopupContainer={(triggerNode) =>
                triggerNode.parentElement || document.body
              }
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
            <button
              type="button"
              onClick={() => setClassDialog("closed")}
              className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={classForm.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {classForm.formState.isSubmitting && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </Dialog>

      {/* Add Multiple Sections Dialog */}
      <Dialog
        open={!!sectionDialog}
        onOpenChange={(open) => {
          if (!open) {
            setSectionDialog(null);
            setPendingSections([]);
            setSectionInput("");
          }
        }}
        title={`Add Sections - ${targetClass?.name ?? "Class"}`}
        description="Add one or multiple sections at once for this class"
        className="max-w-md"
      >
        <div className="space-y-4">
          {/* Current existing sections */}
          {targetClass?.sections && targetClass.sections.length > 0 && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Existing sections in {targetClass.name} (
                {targetClass.sections.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {targetClass.sections.map((s: any) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-md border"
                  >
                    Section {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick presets */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Quick Select / Presets
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["A", "B", "C", "D", "E", "F"].map((letter) => {
                const alreadyExists = targetClass?.sections?.some(
                  (s: any) => s.name.toUpperCase() === letter,
                );
                const isSelected = pendingSections.some(
                  (s) => s.toUpperCase() === letter,
                );

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={alreadyExists}
                    onClick={() => {
                      if (alreadyExists) return;
                      if (isSelected) {
                        removePendingSection(letter);
                      } else {
                        addSectionNames([letter]);
                      }
                    }}
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
                      alreadyExists
                        ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground border-transparent"
                        : isSelected
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                          : "bg-background hover:bg-violet-50 dark:hover:bg-violet-950/30 text-foreground hover:border-violet-300"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    Section {letter}
                    {alreadyExists && (
                      <span className="text-[9px] opacity-75">(added)</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <span>Bundles:</span>
              {[
                ["A", "B"],
                ["A", "B", "C"],
                ["A", "B", "C", "D"],
              ].map((bundle) => {
                const label = bundle.join(", ");
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => addSectionNames(bundle)}
                    className="h-6 px-2 rounded-md bg-muted hover:bg-muted/80 text-[11px] font-medium transition-colors"
                  >
                    + {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input for custom section name / comma separated names */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Type Section Name(s) (press Enter or comma to add)
            </label>
            <div className="flex gap-2">
              <input
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddFromInput();
                  }
                }}
                className={inputCls}
                placeholder="e.g. A, B, C or Rose, Lily"
              />
              <button
                type="button"
                onClick={handleAddFromInput}
                className="h-10 px-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-medium transition-colors flex-shrink-0"
              >
                Add
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Tip: You can type or paste multiple comma-separated sections like
              &quot;A, B, C&quot;.
            </p>
          </div>

          {/* Pending Sections Queue */}
          {pendingSections.length > 0 && (
            <div className="p-3 bg-violet-50/60 dark:bg-violet-950/20 rounded-xl border border-violet-100 dark:border-violet-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">
                  Sections to create ({pendingSections.length}):
                </span>
                <button
                  type="button"
                  onClick={() => setPendingSections([])}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pendingSections.map((sec) => (
                  <span
                    key={sec}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-700 shadow-sm"
                  >
                    <span>{sec}</span>
                    <button
                      type="button"
                      aria-label={`Remove section ${sec}`}
                      onClick={() => removePendingSection(sec)}
                      className="p-0.5 rounded-full hover:bg-violet-100 dark:hover:bg-violet-800 text-violet-600 dark:text-violet-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                setSectionDialog(null);
                setPendingSections([]);
                setSectionInput("");
              }}
              className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                isSubmittingSections ||
                (pendingSections.length === 0 && !sectionInput.trim())
              }
              onClick={() => onSubmitSections()}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmittingSections && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {pendingSections.length > 0
                ? `Add ${pendingSections.length} Section${
                    pendingSections.length > 1 ? "s" : ""
                  }`
                : "Add Sections"}
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteClassTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteClassTarget(null);
        }}
        title="Delete Class"
        description={`Delete "${deleteClassTarget?.name}"? This will also remove all its sections. Students must be moved first.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteClass}
      />

      <ConfirmDialog
        open={!!deleteSectionTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteSectionTarget(null);
        }}
        title="Delete Section"
        description={`Delete section "${deleteSectionTarget?.name}"? Students in this section must be reassigned first.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteSection}
      />
    </div>
  );
}
