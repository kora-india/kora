"use client";

import { useFormContext } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  SCHOOL_TYPES,
  SUBDOMAIN_SUFFIX,
  normalizeSubdomainInput,
  slugify,
  type SetupInput,
} from "../setup-model";
import {
  ChoiceCard,
  ChoiceGroup,
  Field,
  InputGroup,
  SetupSection,
  fieldProps,
  inputCls,
} from "../setup-fields";
import { LogoUploader } from "../logo-uploader";
import type { SubdomainStatus } from "../use-subdomain-check";

export const SUBDOMAIN_TAKEN_MESSAGE =
  "That address is taken. Try adding your city or area.";

function SubdomainHint({
  status,
  subdomain,
}: Readonly<{ status: SubdomainStatus; subdomain?: string }>) {
  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Checking availability…
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {subdomain}
        {SUBDOMAIN_SUFFIX} is available
      </span>
    );
  }
  if (status === "error") {
    return "We couldn't check this right now. We'll check again when you create the school.";
  }
  return "Lowercase letters, numbers and hyphens. We suggest one from your school's name.";
}

export function ProfileStep({
  subdomainStatus,
}: Readonly<{ subdomainStatus: SubdomainStatus }>) {
  const {
    register,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<SetupInput>();

  const nameField = register("name");
  const subdomainField = register("subdomain");
  const subdomain = watch("subdomain");
  const subdomainError =
    errors.subdomain?.message ??
    (subdomainStatus === "taken" ? SUBDOMAIN_TAKEN_MESSAGE : undefined);

  return (
    <>
      <SetupSection
        title="School"
        description="How your school appears across Kora."
      >
        <LogoUploader
          value={watch("logoUrl")}
          onChange={(url) => setValue("logoUrl", url, { shouldDirty: true })}
        />
        <Field id="name" label="School name" error={errors.name?.message}>
          <input
            {...nameField}
            {...fieldProps("name", errors.name?.message)}
            onChange={(e) => {
              // The suggested subdomain follows the name until it is edited.
              const suggested = slugify(getValues("name") ?? "");
              nameField.onChange(e);
              const current = getValues("subdomain");
              if (!current || current === suggested) {
                setValue("subdomain", slugify(e.target.value), {
                  shouldValidate: Boolean(errors.subdomain),
                });
              }
            }}
            autoComplete="organization"
            placeholder="e.g. Delhi Public School, Ranchi"
            className={inputCls}
          />
        </Field>
        <Field
          id="subdomain"
          label="Web address"
          error={subdomainError}
          hint={
            <SubdomainHint status={subdomainStatus} subdomain={subdomain} />
          }
        >
          <InputGroup
            {...subdomainField}
            {...fieldProps("subdomain", subdomainError, true)}
            onChange={(e) => {
              e.target.value = normalizeSubdomainInput(e.target.value);
              subdomainField.onChange(e);
            }}
            suffix={SUBDOMAIN_SUFFIX}
            placeholder="e.g. dps-ranchi"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
      </SetupSection>

      <SetupSection
        title="Institution"
        description="Your size helps us suggest the right plan."
      >
        <ChoiceGroup
          id="schoolType"
          legend="Type of institution"
          error={errors.schoolType?.message}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {SCHOOL_TYPES.map((type) => (
              <ChoiceCard
                key={type.id}
                {...register("schoolType")}
                value={type.id}
                label={type.id}
                icon={type.icon}
                layout="stack"
              />
            ))}
          </div>
        </ChoiceGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="expectedStudents"
            label="Number of students"
            hint="A rough count is fine."
            error={errors.expectedStudents?.message}
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              {...register("expectedStudents")}
              {...fieldProps(
                "expectedStudents",
                errors.expectedStudents?.message,
                true,
              )}
              placeholder="e.g. 1500"
              className={inputCls}
            />
          </Field>
          <Field
            id="expectedStaff"
            label="Number of staff"
            hint="Teachers and office staff."
            error={errors.expectedStaff?.message}
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              {...register("expectedStaff")}
              {...fieldProps(
                "expectedStaff",
                errors.expectedStaff?.message,
                true,
              )}
              placeholder="e.g. 80"
              className={inputCls}
            />
          </Field>
        </div>
      </SetupSection>
    </>
  );
}
