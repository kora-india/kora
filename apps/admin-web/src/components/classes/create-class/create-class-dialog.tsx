"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Loader2,
  PlusCircle,
  School,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { createClass } from "@/lib/actions/classes";
import {
  STANDARD_CLASSES,
  categoryForOrder,
  nameKey,
  validateSectionName,
} from "@/lib/class-catalog";
import { ClassSelector, type ClassOption } from "./class-selector";
import { SectionInput } from "./section-input";
import { TeacherSelector, type TeacherOption } from "./teacher-selector";
import { ClassPreview } from "./class-preview";
import {
  CreateCustomClassModal,
  type CustomClassInput,
} from "./create-custom-class-modal";

export interface ExistingClass {
  id: string;
  name: string;
  grade: number;
}

interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ExistingClass[];
  teachers: TeacherOption[];
  academicYear?: string | null;
  /** Called when the user picks a class that already exists. */
  onManageSections: (classId: string) => void;
  onCreated: () => void;
}

const DEFAULT_SECTIONS = ["A"];

function Step({
  n,
  title,
  description,
  last,
  children,
}: Readonly<{
  n: number;
  title: string;
  description?: string;
  last?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <section className="grid grid-cols-[auto_1fr] gap-x-3 sm:gap-x-4">
      <div className="flex flex-col items-center">
        <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold flex items-center justify-center flex-shrink-0">
          {n}
        </span>
        {!last && <span className="w-px flex-1 bg-border mt-2" aria-hidden />}
      </div>
      <div className={cn("min-w-0", !last && "pb-6")}>
        <h3 className="text-sm font-semibold leading-7">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground -mt-0.5 mb-3">
            {description}
          </p>
        )}
        <div className={cn(!description && "mt-2")}>{children}</div>
      </div>
    </section>
  );
}

export function CreateClassDialog({
  open,
  onOpenChange,
  classes,
  teachers,
  academicYear,
  onManageSections,
  onCreated,
}: Readonly<CreateClassDialogProps>) {
  // Custom classes live here until a real class is created with them, so they
  // survive closing/reopening the dialog during this visit.
  const [customClasses, setCustomClasses] = useState<CustomClassInput[]>([]);
  const [customOpen, setCustomOpen] = useState(false);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSelectedKey(null);
    setSections(DEFAULT_SECTIONS);
    setTeacherId(null);
    setShowErrors(false);
  }, [open]);

  const options = useMemo<ClassOption[]>(() => {
    const existing = new Map(classes.map((c) => [nameKey(c.name), c]));
    const byKey = new Map<string, ClassOption>();

    for (const s of STANDARD_CLASSES) {
      const key = nameKey(s.name);
      byKey.set(key, {
        key,
        name: s.name,
        order: s.order,
        category: categoryForOrder(s.order).id,
        isCustom: false,
        existingId: existing.get(key)?.id,
      });
    }
    // Classes the school already has that aren't in the standard catalog.
    for (const c of classes) {
      const key = nameKey(c.name);
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key,
        name: c.name,
        order: c.grade,
        category: categoryForOrder(c.grade).id,
        isCustom: true,
        existingId: c.id,
      });
    }
    for (const c of customClasses) {
      const key = nameKey(c.name);
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key,
        name: c.name,
        order: c.order,
        category: c.category,
        isCustom: true,
      });
    }
    return [...byKey.values()];
  }, [classes, customClasses]);

  const selected = options.find((o) => o.key === selectedKey) ?? null;
  const teacher = teachers.find((t) => t.id === teacherId) ?? null;

  const classError = !selected ? "Select a class" : null;
  const sectionError = sections
    .map((s) => validateSectionName(s))
    .find(Boolean);

  const handleCustomCreate = (input: CustomClassInput) => {
    setCustomClasses((prev) => [...prev, input]);
    setSelectedKey(nameKey(input.name));
    setCustomOpen(false);
    toast.success(`${input.name} added to the class list`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setShowErrors(true);
    if (!selected || selected.existingId || sectionError) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await createClass({
        name: selected.name,
        grade: selected.order,
        classTeacherId: teacherId,
        initialSections: sections,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const count = sections.length;
      toast.success(
        count > 0
          ? `${selected.name} created with ${count} section${count === 1 ? "" : "s"}`
          : `${selected.name} created`,
      );
      setCustomClasses((prev) =>
        prev.filter((c) => nameKey(c.name) !== selected.key),
      );
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create class");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submittingRef.current) return;
        onOpenChange(next);
      }}
      title="Create New Class"
      description="Set up a class with sections and assign a teacher."
      icon={<School className="w-5 h-5" />}
      className="max-w-2xl max-sm:max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-0"
    >
      <form onSubmit={submit} noValidate>
        <Step n={1} title="Select Class">
          <label
            id="create-class-label"
            htmlFor="create-class-select"
            className="text-xs font-medium block mb-1.5"
          >
            Class<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0">
              <ClassSelector
                id="create-class-select"
                labelId="create-class-label"
                options={options}
                value={selectedKey}
                onChange={setSelectedKey}
                onCreateCustom={() => setCustomOpen(true)}
                invalid={showErrors && !!classError}
              />
            </div>
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="h-10 px-3.5 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors flex items-center justify-center gap-1.5 flex-shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Create Custom Class
            </button>
          </div>
          {showErrors && classError && (
            <p className="text-xs text-red-500 mt-1.5">{classError}</p>
          )}
          {selected?.existingId && (
            <div
              role="alert"
              className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 hidden sm:block" />
              <p className="text-xs text-amber-800 dark:text-amber-200 flex-1">
                <strong>{selected.name}</strong> already exists. You can add or
                manage sections from the existing class.
              </p>
              <button
                type="button"
                onClick={() => onManageSections(selected.existingId!)}
                className="self-start sm:self-auto inline-flex items-center gap-1 h-8 px-3 rounded-md text-xs font-medium bg-white dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition-colors flex-shrink-0"
              >
                Manage sections <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </Step>

        <Step
          n={2}
          title="Add Sections"
          description="Add one or more sections. Use letters, colours, shifts or streams."
        >
          <p id="create-class-sections" className="sr-only">
            Sections
          </p>
          <SectionInput
            value={sections}
            onChange={setSections}
            labelId="create-class-sections"
          />
          {showErrors && sectionError && (
            <p className="text-xs text-red-500 mt-1.5">{sectionError}</p>
          )}
        </Step>

        <Step
          n={3}
          title="Assign Class Teacher"
          description="The class teacher is responsible for this class and all its sections."
          last
        >
          <label
            htmlFor="create-class-teacher"
            className="text-xs font-medium block mb-1.5"
          >
            Class Teacher{" "}
            <span className="text-muted-foreground font-normal">
              (Optional)
            </span>
          </label>
          <TeacherSelector
            id="create-class-teacher"
            teachers={teachers}
            value={teacherId}
            onChange={setTeacherId}
          />
        </Step>

        <div className="mt-6">
          <ClassPreview
            className={selected?.name ?? null}
            category={selected?.category ?? null}
            sections={sections}
            teacherName={teacher?.name ?? null}
          />
        </div>

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 px-5 py-4 bg-card border-t flex flex-col-reverse sm:flex-row sm:items-center gap-3">
          {academicYear ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 sm:mr-auto">
              <CalendarDays className="w-3.5 h-3.5" />
              Academic Year:{" "}
              <span className="font-medium text-foreground">
                {academicYear}
              </span>
            </p>
          ) : (
            <span className="sm:mr-auto" />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none h-10 px-4 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!selected?.existingId}
              aria-busy={submitting}
              className="flex-1 sm:flex-none h-10 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Creating…" : "Create Class"}
            </button>
          </div>
        </div>
      </form>

      <CreateCustomClassModal
        open={customOpen}
        onOpenChange={setCustomOpen}
        knownClasses={options.map((o) => ({
          key: o.key,
          name: o.name,
          order: o.order,
          existing: !!o.existingId,
        }))}
        onCreate={handleCustomCreate}
      />
    </Dialog>
  );
}
