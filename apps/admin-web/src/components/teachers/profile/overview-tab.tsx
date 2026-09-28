"use client";

import {
  Award,
  Briefcase,
  GraduationCap,
  IndianRupee,
  Mail,
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import {
  formatPayrollMonth,
  methodLabel,
  successfulPayout,
  type SalarySlipRecord,
} from "@/lib/payroll";
import { SlipStatusBadge } from "../payroll/ui";
import { formatDate, teachingClasses, type ProfileTeacher } from "./types";

function Panel({
  title,
  icon,
  action,
  children,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label/value pair in the same style as the student details view. */
function Field({
  label,
  value,
}: Readonly<{ label: string; value: React.ReactNode | null | undefined }>) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground font-medium uppercase mb-1">
        {label}
      </p>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

export function OverviewTab({
  teacher,
  slips,
  onOpenClasses,
  onOpenPayroll,
}: Readonly<{
  teacher: ProfileTeacher;
  slips: SalarySlipRecord[];
  onOpenClasses: () => void;
  onOpenPayroll: () => void;
}>) {
  const classes = teachingClasses(teacher);
  const latest = slips[0];
  const lastPaid = slips
    .map((s) => ({ s, p: successfulPayout(s) }))
    .find((x) => x.p);

  const linkBtn = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-violet-600 dark:text-violet-300 hover:underline"
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Contact Information"
        icon={<Mail className="w-3.5 h-3.5" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            value={
              <a href={`mailto:${teacher.email}`} className="hover:underline">
                {teacher.email}
              </a>
            }
          />
          <Field
            label="Phone"
            value={
              teacher.phone ? (
                <a href={`tel:${teacher.phone}`} className="hover:underline">
                  {teacher.phone}
                </a>
              ) : null
            }
          />
        </div>
      </Panel>

      <Panel
        title="Employment Information"
        icon={<Briefcase className="w-3.5 h-3.5" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Joining Date" value={formatDate(teacher.joiningDate)} />
          <Field label="Subjects" value={teacher.subject} />
          <Field label="Qualification" value={teacher.qualification} />
          <Field
            label="Status"
            value={teacher.isActive ? "Active" : "Inactive"}
          />
        </div>
      </Panel>

      <Panel
        title="Teaching Assignment"
        icon={<GraduationCap className="w-3.5 h-3.5" />}
        action={linkBtn("View classes", onOpenClasses)}
      >
        {teacher.classTeacherOf.length === 0 && classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classes assigned to this teacher.
          </p>
        ) : (
          <div className="space-y-4">
            {teacher.classTeacherOf.length > 0 && (
              <Field
                label="Class Teacher"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    {teacher.classTeacherOf.map((c) => c.name).join(", ")}
                  </span>
                }
              />
            )}
            {classes.length > 0 && (
              <Field
                label="Teaching Classes"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map((c) => (
                      <span
                        key={c.key}
                        className="px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800"
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                }
              />
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Salary Summary"
        icon={<IndianRupee className="w-3.5 h-3.5" />}
        action={linkBtn("View payroll", onOpenPayroll)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Monthly Salary"
            value={
              teacher.salary != null ? (
                formatCurrency(teacher.salary)
              ) : (
                <span className="text-muted-foreground font-normal">
                  Not set
                </span>
              )
            }
          />
          <Field
            label="Payment Frequency"
            value={teacher.salary != null ? "Monthly" : null}
          />
          <Field
            label="Latest Slip"
            value={
              latest ? (
                <span className="inline-flex items-center gap-2 flex-wrap">
                  {formatPayrollMonth(latest.year, latest.month)}
                  <SlipStatusBadge status={latest.status} />
                </span>
              ) : null
            }
          />
          <Field
            label="Last Payment"
            value={
              lastPaid?.p
                ? `${formatCurrency(lastPaid.p.amount)} via ${methodLabel(lastPaid.p.method)} · ${formatDate(lastPaid.p.processedAt ?? lastPaid.p.createdAt)}`
                : null
            }
          />
        </div>
      </Panel>
    </div>
  );
}
