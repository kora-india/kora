"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import { updatePlan } from "@/lib/actions/plans";
import {
  MAX_BENEFITS,
  parsePlanInput,
  planToInput,
  type PlanFieldErrors,
  type PlanInput,
} from "@/lib/plan-input";
import {
  PLAN_MODULES,
  type FeatureKey,
  type PlanDefinition,
} from "@/lib/plans";

const LIMIT_FIELDS = [
  { key: "maxStudents", label: "Students" },
  { key: "maxTeachers", label: "Teachers" },
  { key: "maxClasses", label: "Classes" },
] as const;

type LimitKey = (typeof LIMIT_FIELDS)[number]["key"];

/** "" while typing becomes NaN, which the form reports as "Enter a number". */
const toNumber = (value: string) => (value === "" ? NaN : Number(value));

/**
 * The super admin's editor for one plan (U1). Saving updates the pricing
 * page, setup, billing, the limit checks and the module gates at once.
 * Mount it when it opens, so it starts from the plan as saved.
 */
export function PlanEditorDialog({
  plan,
  schoolCount,
  open,
  onOpenChange,
}: Readonly<{
  plan: PlanDefinition;
  /** Schools on this plan now, who feel limit and module changes at once. */
  schoolCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const router = useRouter();
  const [draft, setDraft] = useState<PlanInput>(() => planToInput(plan));
  const [errors, setErrors] = useState<PlanFieldErrors>({});
  const [saving, setSaving] = useState(false);
  // The number each limit goes back to when "Unlimited" is turned off.
  const [lastLimits, setLastLimits] = useState<Record<LimitKey, number>>(
    () => ({
      maxStudents: draft.maxStudents ?? 1000,
      maxTeachers: draft.maxTeachers ?? 50,
      maxClasses: draft.maxClasses ?? 30,
    }),
  );
  const isFree = plan.id === "FREE";

  const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setFeature = (index: number, value: string) =>
    set(
      "features",
      draft.features.map((f, i) => (i === index ? value : f)),
    );

  const moveFeatureUp = (index: number) => {
    const next = [...draft.features];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    set("features", next);
  };

  const toggleModule = (key: FeatureKey) =>
    set(
      "modules",
      draft.modules.includes(key)
        ? draft.modules.filter((m) => m !== key)
        : [...draft.modules, key],
    );

  const toggleUnlimited = (key: LimitKey) => {
    const current = draft[key];
    if (current === null) {
      set(key, lastLimits[key]);
    } else {
      if (Number.isFinite(current)) {
        setLastLimits((l) => ({ ...l, [key]: current }));
      }
      set(key, null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const checked = parsePlanInput(plan.id, draft);
    if ("error" in checked) {
      setErrors(checked.fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const result = await updatePlan(plan.id, draft);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${plan.name} plan`}
      description="Shown on the pricing page, at registration and on billing."
      icon={<Pencil className="w-4 h-4" />}
      className="max-w-2xl"
    >
      <form onSubmit={save} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Plan name"
            htmlFor="plan-name"
            error={errors.name}
            required
          >
            <input
              id="plan-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={40}
              className={inputCls}
            />
          </FormField>
          <FormField
            label="Monthly price (₹)"
            htmlFor="plan-price"
            description={
              isFree
                ? "The Free plan is always ₹0."
                : "Charged from each school's next payment."
            }
            error={errors.monthlyPriceInr}
            required
          >
            <input
              id="plan-price"
              type="number"
              inputMode="numeric"
              min={isFree ? 0 : 1}
              step={1}
              value={
                Number.isNaN(draft.monthlyPriceInr) ? "" : draft.monthlyPriceInr
              }
              onChange={(e) => set("monthlyPriceInr", toNumber(e.target.value))}
              disabled={isFree}
              className={inputCls}
            />
          </FormField>
        </div>

        <FormField
          label="Tagline"
          htmlFor="plan-tagline"
          error={errors.tagline}
          required
        >
          <input
            id="plan-tagline"
            value={draft.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            maxLength={120}
            placeholder="For growing schools that want the full toolkit."
            className={inputCls}
          />
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">Limits</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {LIMIT_FIELDS.map(({ key, label }) => {
              const value = draft[key];
              const unlimited = value === null;
              return (
                <div key={key} className="space-y-1.5">
                  <label
                    htmlFor={`plan-${key}`}
                    className="text-xs text-muted-foreground block"
                  >
                    {label}
                  </label>
                  <input
                    id={`plan-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={value === null || Number.isNaN(value) ? "" : value}
                    placeholder={unlimited ? "Unlimited" : undefined}
                    onChange={(e) => set(key, toNumber(e.target.value))}
                    disabled={unlimited}
                    className={inputCls}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unlimited}
                      onChange={() => toggleUnlimited(key)}
                      className="rounded"
                    />
                    Unlimited
                  </label>
                  {errors[key] && (
                    <p className="text-xs text-red-500">{errors[key]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">Modules</legend>
          <p className="text-xs text-muted-foreground">
            Schools on this plan can open these. Mention them in the benefits so
            the pricing page matches.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_MODULES.map(({ key, label }) => (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                  draft.modules.includes(key)
                    ? "border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30"
                    : "hover:bg-muted/40",
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.modules.includes(key)}
                  onChange={() => toggleModule(key)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">
            Benefits<span className="text-red-500 ml-0.5">*</span>
          </legend>
          <p className="text-xs text-muted-foreground">
            The list schools see under the price, in this order.
          </p>
          <ul className="space-y-2">
            {draft.features.map((feature, i) => (
              <li key={i}>
                <div className="flex items-center gap-1.5">
                  <input
                    value={feature}
                    onChange={(e) => setFeature(i, e.target.value)}
                    maxLength={120}
                    aria-label={`Benefit ${i + 1}`}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => moveFeatureUp(i)}
                    disabled={i === 0}
                    aria-label={`Move benefit ${i + 1} up`}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "features",
                        draft.features.filter((_, j) => j !== i),
                      )
                    }
                    aria-label={`Remove benefit ${i + 1}`}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {errors[`features.${i}`] && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors[`features.${i}`]}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {errors.features && (
            <p className="text-xs text-red-500">{errors.features}</p>
          )}
          {draft.features.length < MAX_BENEFITS && (
            <button
              type="button"
              onClick={() => set("features", [...draft.features, ""])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              <Plus className="w-3.5 h-3.5" /> Add benefit
            </button>
          )}
        </fieldset>

        {!isFree && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={draft.popular}
              onChange={(e) => set("popular", e.target.checked)}
              className="rounded mt-0.5"
            />
            <span>
              Mark as most popular
              <span className="block text-xs text-muted-foreground">
                Highlights this plan; any other plan loses the badge.
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Limits and modules change right away for{" "}
            {schoolCount === 1 ? "1 school" : `${schoolCount} schools`} on this
            plan.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save plan
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
