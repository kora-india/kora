"use client";

import { useState } from "react";
import {
  Building2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@schoolos/utils";
import { FormField, inputCls } from "@/components/ui/form-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { AdmissionNumberConfigCard } from "@/components/settings/admission-number-config-card";
import { ThemeColorCard } from "@/components/settings/theme-color-card";
import { SchoolLogoEditor } from "@/components/settings/school-logo-editor";
import { updateSchoolProfile } from "@/lib/actions/settings";
import type { ThemeColor } from "@schoolos/types";

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
    logoUrl: string | null;
    themeColor: ThemeColor;
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
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("School profile updated");
    setEditing(false);
    router.refresh();
  };

  const rows: { label: string; value: string | null; icon: LucideIcon }[] = [
    { label: "Address", value: school.address, icon: MapPin },
    { label: "Phone", value: school.phone, icon: Phone },
    { label: "Email", value: school.email, icon: Mail },
  ];

  const profileCard = (
    <SettingsCard
      id="tour-settings-profile"
      icon={Building2}
      title="School Profile"
      description="Basic information about your school."
      action={
        canEdit && !editing ? (
          <button
            type="button"
            onClick={() => {
              form.reset({
                name: school.name,
                address: school.address ?? "",
                phone: school.phone ?? "",
                email: school.email ?? "",
              });
              setEditing(true);
            }}
            className="flex items-center gap-2 h-9 px-4 border rounded-lg bg-background text-sm font-medium shadow-sm hover:bg-muted transition-colors flex-shrink-0 self-start"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="School Name"
            error={form.formState.errors.name?.message}
            required
          >
            <input
              {...form.register("name")}
              className={inputCls}
              placeholder="School name"
            />
          </FormField>
          <FormField
            label="Address"
            error={form.formState.errors.address?.message}
          >
            <input
              {...form.register("address")}
              className={inputCls}
              placeholder="School address"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Phone"
              error={form.formState.errors.phone?.message}
            >
              <input
                {...form.register("phone")}
                className={inputCls}
                placeholder="Contact phone"
              />
            </FormField>
            <FormField
              label="Email"
              error={form.formState.errors.email?.message}
            >
              <input
                {...form.register("email")}
                type="email"
                className={inputCls}
                placeholder="Contact email"
              />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start gap-4 pb-5">
            <SchoolLogoEditor
              schoolName={school.name}
              logoUrl={school.logoUrl}
              canEdit={canEdit}
            />
            <div className="min-w-0 pt-3">
              <p className="text-lg font-semibold leading-tight break-words">
                {school.name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  {school.plan} Plan
                </span>
                <span className="text-xs text-muted-foreground">
                  School ID{" "}
                  <span className="font-mono text-foreground/80">
                    {school.subdomain}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <dl className="divide-y border-t">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 py-3 last:pb-0 sm:grid-cols-[auto_7rem_minmax(0,1fr)]"
              >
                <row.icon
                  className="mt-0.5 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="col-start-2 text-sm font-medium break-words sm:col-start-auto">
                  {row.value || (
                    <span className="font-normal text-muted-foreground">
                      Not set
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </SettingsCard>
  );

  return (
    <div className="space-y-6">
      <div
        className={cn("grid gap-6 items-start", canEdit && "lg:grid-cols-2")}
      >
        {profileCard}
        {canEdit && <ThemeColorCard current={school.themeColor} />}
      </div>

      {/* Only admins can read the format; others would see placeholder values. */}
      {canEdit && <AdmissionNumberConfigCard canEdit variant="page" />}
    </div>
  );
}
