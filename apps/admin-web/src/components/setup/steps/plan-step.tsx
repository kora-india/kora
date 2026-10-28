"use client";

import { useFormContext } from "react-hook-form";
import { AlertTriangle, Check, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@schoolos/utils";
import {
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN,
  formatLimit,
  formatPlanPrice,
  paidPlansByPrice,
  type PaidPlanId,
  type PlanCatalog,
} from "@/lib/plans";
import {
  GRADING_OPTIONS,
  SHIFTS,
  academicSessionOptions,
  describeClasses,
  describeWorkingDays,
  fitsPlan,
  recommendedPlan,
  type PlanChoice,
  type SavedPayment,
  type SetupInput,
  type StepId,
} from "../setup-model";
import { SetupSection } from "../setup-fields";

const labelFor = (
  options: { value: string; label: string }[],
  value?: string,
) => options.find((o) => o.value === value)?.label ?? value ?? "";

function SummaryRow({
  title,
  step,
  items,
  onEdit,
}: Readonly<{
  title: string;
  step: StepId;
  items: [string, React.ReactNode][];
  onEdit: (step: StepId) => void;
}>) {
  return (
    <div className="grid gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[7rem,1fr,auto]">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map(([term, detail]) => (
          <div key={term} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="mt-0.5 break-words text-sm">{detail || "—"}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => onEdit(step)}
        aria-label={`Edit ${title.toLowerCase()}`}
        className="inline-flex h-8 items-center gap-1.5 self-start justify-self-start rounded-lg px-2 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-violet-400 dark:hover:bg-violet-900/30"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit
      </button>
    </div>
  );
}

export function SchoolSummary({
  onEdit,
}: Readonly<{ onEdit: (step: StepId) => void }>) {
  const { getValues } = useFormContext<SetupInput>();
  const v = getValues();
  const session = academicSessionOptions().find(
    (s) => s.value === v.academicSession,
  );
  const students = Number(v.expectedStudents) || 0;
  const staff = Number(v.expectedStaff) || 0;

  return (
    <SetupSection
      title="Your school"
      description="Check these before you continue. You can change most of them later in Settings."
    >
      <div className="divide-y">
        <SummaryRow
          title="Profile"
          step={1}
          onEdit={onEdit}
          items={[
            ["Name", v.name],
            ["School ID", v.subdomain],
            ["Type", v.schoolType],
            [
              "Size",
              `${formatLimit(students)} students · ${formatLimit(staff)} staff`,
            ],
          ]}
        />
        <SummaryRow
          title="Location"
          step={2}
          onEdit={onEdit}
          items={[
            [
              "Address",
              [v.address, v.city, `${v.state} ${v.pincode}`.trim()]
                .filter(Boolean)
                .join(", "),
            ],
            [
              "Contact",
              [v.phone && `+91 ${v.phone}`, v.email]
                .filter(Boolean)
                .join(" · "),
            ],
          ]}
        />
        <SummaryRow
          title="Academic"
          step={3}
          onEdit={onEdit}
          items={[
            [
              "Board",
              `${v.board} · ${labelFor(GRADING_OPTIONS, v.gradingSystem)}`,
            ],
            ["Session", session?.label ?? v.academicSession],
            ["Classes", describeClasses(v.classes ?? [])],
            [
              "Week",
              `${describeWorkingDays(v.workingDays ?? [])} · ${labelFor(SHIFTS, v.schoolShift)}`,
            ],
          ]}
        />
      </div>
    </SetupSection>
  );
}

const optionCls =
  "group relative flex cursor-pointer flex-col rounded-xl border bg-background p-5 text-left transition-colors hover:border-foreground/20 has-[:checked]:border-violet-500 has-[:checked]:ring-1 has-[:checked]:ring-violet-500/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background";

function RadioDot() {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-input bg-background transition-colors group-has-[:checked]:border-violet-600 group-has-[:checked]:bg-violet-600 dark:group-has-[:checked]:border-violet-400 dark:group-has-[:checked]:bg-violet-400"
    >
      <Check className="hidden h-3 w-3 text-white group-has-[:checked]:block dark:text-zinc-950" />
    </span>
  );
}

function Badge({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
      {children}
    </span>
  );
}

function OverLimit({
  limit,
  students,
}: Readonly<{ limit: number; students: number }>) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      Covers {formatLimit(limit)} students; you expect {formatLimit(students)}.
    </p>
  );
}

export function PlanStep({
  plans,
  choice,
  onChoiceChange,
  savedPayment,
  onEdit,
}: Readonly<{
  plans: PlanCatalog;
  choice: PlanChoice;
  onChoiceChange: (choice: PlanChoice) => void;
  savedPayment: SavedPayment | null;
  onEdit: (step: StepId) => void;
}>) {
  const { getValues } = useFormContext<SetupInput>();
  const students = Number(getValues("expectedStudents")) || 0;
  const suggested: PaidPlanId | null = students
    ? recommendedPlan(plans, students)
    : null;
  const trialLimit = plans[TRIAL_PLAN].limits.maxStudents;

  return (
    <>
      <SchoolSummary onEdit={onEdit} />

      {savedPayment ? (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <div>
            <p className="font-semibold">We received your payment</p>
            <p className="mt-0.5 text-sm opacity-90">
              Your {plans[savedPayment.plan]?.name ?? savedPayment.plan} plan is
              paid. Finish setup to create your school; you won&apos;t be
              charged again.
            </p>
          </div>
        </div>
      ) : (
        <SetupSection
          title="Choose how to start"
          description="Start free, or pay now and skip the trial."
        >
          <div
            role="radiogroup"
            aria-label="How to start"
            className="space-y-4"
          >
            <label
              className={cn(optionCls, "sm:flex-row sm:items-center sm:gap-6")}
            >
              <input
                type="radio"
                name="plan-choice"
                value="TRIAL"
                checked={choice === "TRIAL"}
                onChange={() => onChoiceChange("TRIAL")}
                className="sr-only"
                aria-label={`Free trial for ${TRIAL_DURATION_DAYS} days`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">Free trial</span>
                  <Badge>No payment</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every {plans[TRIAL_PLAN].name} feature for{" "}
                  {TRIAL_DURATION_DAYS} days, up to {formatLimit(trialLimit)}{" "}
                  students. Choose a plan when the trial ends.
                </p>
                {students > trialLimit && (
                  <OverLimit limit={trialLimit} students={students} />
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 sm:mt-0 sm:justify-end">
                <p>
                  <span className="text-2xl font-bold">₹0</span>
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    for {TRIAL_DURATION_DAYS} days
                  </span>
                </p>
                <RadioDot />
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              {paidPlansByPrice(plans).map((plan) => {
                const { id } = plan;
                const badge =
                  suggested === id
                    ? "Fits your school"
                    : !suggested && plan.popular
                      ? "Popular"
                      : null;
                return (
                  <label key={id} className={optionCls}>
                    <input
                      type="radio"
                      name="plan-choice"
                      value={id}
                      checked={choice === id}
                      onChange={() => onChoiceChange(id)}
                      className="sr-only"
                      aria-label={`${plan.name}, ${formatPlanPrice(plan)} a month`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold">{plan.name}</span>
                        {badge && <Badge>{badge}</Badge>}
                      </div>
                      <RadioDot />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.tagline}
                    </p>
                    <p className="mt-4">
                      <span className="text-2xl font-bold">
                        {formatPlanPrice(plan)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        / month
                      </span>
                    </p>
                    <ul className="mt-4 flex-1 space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                            aria-hidden
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {!fitsPlan(plans, id, students) && (
                      <OverLimit
                        limit={plan.limits.maxStudents}
                        students={students}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </SetupSection>
      )}
    </>
  );
}
