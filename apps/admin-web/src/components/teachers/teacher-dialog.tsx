"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Select } from "antd";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import { createTeacher, updateTeacher } from "@/lib/actions/teachers";

const Schema = z.object({
  name: z.string().min(2, "Required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  qualification: z.string().optional(),
  salary: z.coerce.number().min(0).optional().nullable(),
  joiningDate: z.string().optional().nullable(),
});

type FormData = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher?: any;
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
}

export function TeacherDialog({ open, onOpenChange, teacher, classes }: Readonly<Props>) {
  const router = useRouter();
  const isEdit = !!teacher;
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  });

  const groupedSectionOptions = useMemo(() => {
    return classes.map((c) => ({
      label: c.name,
      options: (c.sections || []).map((s) => ({
        label: `${c.name} · Section ${s.name}`,
        value: s.id,
      })),
    }));
  }, [classes]);

  useEffect(() => {
    if (teacher) {
      const initialSectionIds: string[] = teacher.assignedSections?.map((as: any) => as.sectionId) ??
        (teacher.assignedSectionId ? [teacher.assignedSectionId] : []);
      setSelectedSectionIds(initialSectionIds);

      reset({
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone ?? "",
        subject: teacher.subject,
        qualification: teacher.qualification ?? "",
        salary: teacher.salary ? Number(teacher.salary) : undefined,
        joiningDate: teacher.joiningDate ? new Date(teacher.joiningDate).toISOString().split("T")[0] : "",
      });
    } else {
      setSelectedSectionIds([]);
      reset({
        name: "",
        email: "",
        phone: "",
        subject: "",
        qualification: "",
        salary: undefined,
        joiningDate: new Date().toISOString().split("T")[0],
      });
    }
  }, [teacher, open, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      assignedSectionIds: selectedSectionIds,
    };

    if (isEdit) {
      const result = await updateTeacher(teacher.id, payload);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Teacher updated");
      onOpenChange(false);
      router.refresh();
      return;
    }

    const result = await createTeacher(payload);
    if (result.error || !result.tempPassword) { toast.error(result.error ?? "Failed to create teacher"); return; }
    setTempPassword(result.tempPassword);
    setShowTempPassword(false);
    router.refresh();
  };

  const handleDone = () => {
    setTempPassword(null);
    onOpenChange(false);
  };

  if (tempPassword) {
    return (
      <Dialog
        open={open}
        onOpenChange={(o) => { if (!o) handleDone(); }}
        title="Teacher Added"
        description="Share these credentials with the teacher securely."
      >
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Temporary Password</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-mono font-semibold">
                  {showTempPassword ? tempPassword : "••••••••••••"}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={showTempPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowTempPassword(!showTempPassword)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {showTempPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Copy temporary password"
                    onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Password copied!"); }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            ⚠️ Save this password now. It will not be shown again. The teacher should change it after first login.
          </p>
          <button
            type="button"
            onClick={handleDone}
            className="w-full h-9 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Done
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Teacher" : "Add New Teacher"}
      description={isEdit ? "Update teacher details" : "A login account will be created with a temporary password"}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" error={errors.name?.message} required className="col-span-2">
            <input {...register("name")} className={inputCls} placeholder="e.g. Priya Nair" />
          </FormField>

          <FormField label="Email" error={errors.email?.message} required>
            <input {...register("email")} type="email" className={inputCls} placeholder="teacher@school.edu" />
          </FormField>

          <FormField label="Phone" error={errors.phone?.message}>
            <input {...register("phone")} className={inputCls} placeholder="+91 98765 43210" />
          </FormField>

          <FormField label="Subject" error={errors.subject?.message} required>
            <input {...register("subject")} className={inputCls} placeholder="e.g. Mathematics" />
          </FormField>

          <FormField label="Qualification" error={errors.qualification?.message}>
            <input {...register("qualification")} className={inputCls} placeholder="e.g. M.Sc, B.Ed" />
          </FormField>

          <FormField label="Monthly Salary (₹)" error={errors.salary?.message}>
            <input {...register("salary")} type="number" min="0" className={inputCls} placeholder="e.g. 35000" />
          </FormField>

          <FormField label="Joining Date" error={errors.joiningDate?.message}>
            <input {...register("joiningDate")} type="date" className={inputCls} />
          </FormField>

          <FormField label="Assigned Classes & Sections" className="col-span-2">
            <div className="w-full mt-1">
              <Select
                mode="multiple"
                allowClear
                placeholder="Select classes and sections taught by this teacher"
                value={selectedSectionIds}
                onChange={setSelectedSectionIds}
                options={groupedSectionOptions}
                getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
                dropdownStyle={{ maxHeight: 260, overflowY: "auto" }}
                virtual={false}
                className="w-full ant-select-custom"
                style={{ width: "100%" }}
                size="large"
                maxTagCount="responsive"
                dropdownRender={(menu) => (
                  <div
                    onWheel={(e) => e.stopPropagation()}
                    style={{ maxHeight: 260, overflowY: "auto" }}
                  >
                    {menu}
                  </div>
                )}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                You can assign this teacher to multiple classes and sections.
              </p>
            </div>
          </FormField>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <button type="button" onClick={() => onOpenChange(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Teacher"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
