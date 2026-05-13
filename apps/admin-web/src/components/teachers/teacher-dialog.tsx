"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { createTeacher, updateTeacher } from "@/lib/actions/teachers";

const Schema = z.object({
  name: z.string().min(2, "Required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  qualification: z.string().optional(),
  assignedClassId: z.string().optional(),
  assignedSectionId: z.string().optional(),
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

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  });

  const selectedClassId = watch("assignedClassId");
  const sections = classes.find((c) => c.id === selectedClassId)?.sections ?? [];

  useEffect(() => {
    if (teacher) {
      reset({
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone ?? "",
        subject: teacher.subject,
        qualification: teacher.qualification ?? "",
        assignedClassId: teacher.assignedClassId ?? "",
        assignedSectionId: teacher.assignedSectionId ?? "",
      });
    } else {
      reset({ name: "", email: "", phone: "", subject: "", qualification: "", assignedClassId: "", assignedSectionId: "" });
    }
  }, [teacher, open, reset]);

  const onSubmit = async (data: FormData) => {
    const result = isEdit ? await updateTeacher(teacher.id, data) : await createTeacher(data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEdit ? "Teacher updated" : "Teacher added — default password: Welcome@123");
      onOpenChange(false);
      router.refresh();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Teacher" : "Add New Teacher"}
      description={isEdit ? "Update teacher details" : "A login account will be created with password Welcome@123"}
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

          <FormField label="Assigned Class" error={errors.assignedClassId?.message}>
            <select {...register("assignedClassId")} className={selectCls}>
              <option value="">No class assigned</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Assigned Section" error={errors.assignedSectionId?.message}>
            <select {...register("assignedSectionId")} className={selectCls} disabled={!selectedClassId}>
              <option value="">No section assigned</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
