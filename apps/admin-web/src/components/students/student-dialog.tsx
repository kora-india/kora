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
import { createStudent, updateStudent } from "@/lib/actions/students";

const Schema = z.object({
  name: z.string().min(2, "Required"),
  rollNumber: z.string().min(1, "Required"),
  admissionNumber: z.string().min(1, "Required"),
  classId: z.string().min(1, "Required"),
  sectionId: z.string().min(1, "Required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  parentName: z.string().min(2, "Required"),
  parentPhone: z.string().min(6, "Required"),
  parentEmail: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: any;
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
}

export function StudentDialog({ open, onOpenChange, student, classes }: Props) {
  const router = useRouter();
  const isEdit = !!student;

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      gender: "MALE",
      name: "",
      rollNumber: "",
      admissionNumber: "",
      classId: "",
      sectionId: "",
      parentName: "",
      parentPhone: "",
    },
  });

  const selectedClassId = watch("classId");
  const sections = classes.find((c) => c.id === selectedClassId)?.sections ?? [];

  useEffect(() => {
    if (student) {
      reset({
        name: student.name,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        classId: student.classId,
        sectionId: student.sectionId,
        gender: student.gender,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail ?? "",
        dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : "",
        address: student.address ?? "",
      });
    } else {
      reset({
        gender: "MALE",
        name: "",
        rollNumber: "",
        admissionNumber: "",
        classId: "",
        sectionId: "",
        parentName: "",
        parentPhone: "",
        parentEmail: "",
        dateOfBirth: "",
        address: "",
      });
    }
  }, [student, open, reset]);

  const onSubmit = async (data: FormData) => {
    const result = isEdit ? await updateStudent(student.id, data) : await createStudent(data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEdit ? "Student updated" : "Student created successfully");
      onOpenChange(false);
      router.refresh();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Student" : "Add New Student"}
      description={isEdit ? "Update student details" : "Fill in the details to enroll a new student"}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" error={errors.name?.message} required className="col-span-2">
            <input {...register("name")} className={inputCls} placeholder="e.g. Aarav Sharma" />
          </FormField>

          <FormField label="Admission Number" error={errors.admissionNumber?.message} required>
            <input {...register("admissionNumber")} className={inputCls} placeholder="ADM-2024-001" />
          </FormField>

          <FormField label="Roll Number" error={errors.rollNumber?.message} required>
            <input {...register("rollNumber")} className={inputCls} placeholder="01" />
          </FormField>

          <FormField label="Class" error={errors.classId?.message} required>
            <select {...register("classId")} className={selectCls}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Section" error={errors.sectionId?.message} required>
            <select {...register("sectionId")} className={selectCls} disabled={!selectedClassId}>
              <option value="">Select section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Gender" error={errors.gender?.message} required>
            <select {...register("gender")} className={selectCls}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>

          <FormField label="Date of Birth" error={errors.dateOfBirth?.message}>
            <input {...register("dateOfBirth")} type="date" className={inputCls} />
          </FormField>

          <FormField label="Parent / Guardian Name" error={errors.parentName?.message} required>
            <input {...register("parentName")} className={inputCls} placeholder="Parent full name" />
          </FormField>

          <FormField label="Parent Phone" error={errors.parentPhone?.message} required>
            <input {...register("parentPhone")} className={inputCls} placeholder="+91 98765 43210" />
          </FormField>

          <FormField label="Parent Email" error={errors.parentEmail?.message}>
            <input {...register("parentEmail")} type="email" className={inputCls} placeholder="parent@email.com" />
          </FormField>

          <FormField label="Address" error={errors.address?.message} className="col-span-2">
            <input {...register("address")} className={inputCls} placeholder="Home address" />
          </FormField>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Enroll Student"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
