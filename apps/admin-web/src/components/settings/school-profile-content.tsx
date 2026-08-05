"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FormField, inputCls } from "@/components/ui/form-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { updateSchoolProfile } from "@/lib/actions/settings";

const SchoolProfileSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Valid email required").or(z.literal("")),
});

type SchoolProfileForm = z.infer<typeof SchoolProfileSchema>;

interface Props {
  school: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    subdomain: string;
    plan: string;
  };
  canEdit: boolean;
}

export function SchoolProfileContent({ school, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const form = useForm<SchoolProfileForm>({
    resolver: zodResolver(SchoolProfileSchema),
    defaultValues: {
      name: school.name,
      address: school.address ?? "",
      phone: school.phone ?? "",
      email: school.email ?? "",
    },
  });

  const onSubmit = async (data: SchoolProfileForm) => {
    const result = await updateSchoolProfile(data);
    if (result.error) { toast.error(result.error); return; }
    toast.success("School profile updated");
    setEditing(false);
    router.refresh();
  };

  const fields: { label: string; value: string | null }[] = [
    { label: "School Name", value: school.name },
    { label: "Address", value: school.address },
    { label: "Phone", value: school.phone },
    { label: "Email", value: school.email },
  ];

  return (
    <SettingsCard
      title="School Profile"
      description={`${school.subdomain}.schoolos · ${school.plan} plan`}
      action={
        canEdit && !editing ? (
          <button
            type="button"
            onClick={() => { form.reset({ name: school.name, address: school.address ?? "", phone: school.phone ?? "", email: school.email ?? "" }); setEditing(true); }}
            className="flex items-center gap-2 h-8 px-3 border rounded-lg text-xs font-medium hover:bg-muted transition-colors flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="School Name" error={form.formState.errors.name?.message} required>
            <input {...form.register("name")} className={inputCls} placeholder="School name" />
          </FormField>
          <FormField label="Address" error={form.formState.errors.address?.message}>
            <input {...form.register("address")} className={inputCls} placeholder="School address" />
          </FormField>
          <FormField label="Phone" error={form.formState.errors.phone?.message}>
            <input {...form.register("phone")} className={inputCls} placeholder="Contact phone" />
          </FormField>
          <FormField label="Email" error={form.formState.errors.email?.message}>
            <input {...form.register("email")} type="email" className={inputCls} placeholder="Contact email" />
          </FormField>
          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setEditing(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {form.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <dl className="divide-y">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
              <dd className="text-sm">{f.value || <span className="text-muted-foreground">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </SettingsCard>
  );
}
