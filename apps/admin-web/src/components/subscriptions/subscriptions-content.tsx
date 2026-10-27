"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  Check,
  Building2,
  Users,
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  HelpCircle,
  Pencil,
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import {
  PLAN_IDS,
  PLAN_MODULES,
  formatLimit,
  type PlanCatalog,
  type PlanId,
} from "@/lib/plans";
import { PlanEditorDialog } from "./plan-editor-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateSchoolPlan } from "@/lib/actions/schools";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SchoolSubItem {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  isActive: boolean;
  studentCount: number;
  maxStudents: number;
  teacherCount: number;
  maxTeachers: number;
}

interface SubscriptionsContentProps {
  /** The live plan catalogue (`getPlanCatalog()`). */
  plans: PlanCatalog;
  schools: SchoolSubItem[];
  planCounts: Record<string, number>;
}

const BADGE_COLORS: Record<PlanId, string> = {
  FREE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  BASIC: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PRO: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  ENTERPRISE:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const moduleLabel = (key: string) =>
  PLAN_MODULES.find((m) => m.key === key)?.label ?? key;

export function SubscriptionsContent({
  plans,
  schools,
  planCounts,
}: Readonly<SubscriptionsContentProps>) {
  const router = useRouter();
  const [editingPlan, setEditingPlan] = useState<PlanId | null>(null);
  const planName = (id: string) => plans[id as PlanId]?.name ?? id;
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("ALL");
  const [planTarget, setPlanTarget] = useState<{
    school: SchoolSubItem;
    plan: string;
  } | null>(null);

  const filteredSchools = schools.filter(
    (s) => selectedPlanFilter === "ALL" || s.plan === selectedPlanFilter,
  );

  const handlePlanChange = async () => {
    if (!planTarget) return;
    const result = await updateSchoolPlan(
      planTarget.school.id,
      planTarget.plan,
    );
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setPlanTarget(null);
    router.refresh();
  };

  const totalMonthlyRevenue = Object.entries(planCounts).reduce(
    (acc, [plan, count]) =>
      acc + (plans[plan as PlanId]?.monthlyPriceInr ?? 0) * count,
    0,
  );

  return (
    <div className="p-6 space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            SaaS Subscription Plans & Billing
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Manage multi-tenant subscription tiers, pricing limits, and school
            allocations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-card border rounded-lg px-3.5 py-1.5 text-right shadow-sm">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Estimated Monthly MRR
            </span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalMonthlyRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Plan Tiers Grid */}
      <div
        id="tour-subscriptions-stats"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {PLAN_IDS.map((id) => {
          const plan = plans[id];
          const count = planCounts[id] ?? 0;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border bg-card p-5 flex flex-col justify-between transition-all relative ${
                plan.popular
                  ? "border-violet-400 ring-2 ring-violet-500/20 shadow-md"
                  : "border-border hover:border-violet-300 dark:hover:border-violet-800"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${BADGE_COLORS[id]}`}
                  >
                    {plan.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {count} {count === 1 ? "School" : "Schools"}
                  </span>
                </div>

                <div className="mt-4 mb-2">
                  <span className="text-3xl font-extrabold text-foreground">
                    {plan.monthlyPriceInr === 0
                      ? "Free"
                      : formatCurrency(plan.monthlyPriceInr)}
                  </span>
                  {plan.monthlyPriceInr > 0 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      /mo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground min-h-[32px]">
                  {plan.tagline}
                </p>

                <div className="my-4 py-3 border-y space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>Student Limit:</span>
                    <span className="font-semibold">
                      {formatLimit(plan.limits.maxStudents)} Students
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>Teacher Limit:</span>
                    <span className="font-semibold">
                      {formatLimit(plan.limits.maxTeachers)} Teachers
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>Class Limit:</span>
                    <span className="font-semibold">
                      {formatLimit(plan.limits.maxClasses)} Classes
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Modules
                  </p>
                  <p className="text-[11px] text-foreground">
                    {plan.modules.length
                      ? plan.modules.map(moduleLabel).join(" · ")
                      : "Core modules only"}
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Included Features
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                        <span className="text-[11px]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(id)}
                  aria-label={`Edit ${plan.name} plan`}
                  className="h-8 text-xs font-semibold rounded-lg transition-colors border bg-violet-600 text-white border-violet-600 hover:bg-violet-700 flex items-center justify-center gap-1.5"
                >
                  <Pencil className="w-3 h-3" /> Edit plan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPlanFilter(
                      id === selectedPlanFilter ? "ALL" : id,
                    )
                  }
                  className={`h-8 text-xs font-semibold rounded-lg transition-colors border ${
                    selectedPlanFilter === id
                      ? "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  {selectedPlanFilter === id ? "Show all" : "Show schools"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schools Subscription Table */}
      <div
        id="tour-subscriptions-table"
        className="rounded-xl border bg-card overflow-hidden space-y-0"
      >
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-600" />
              School Plan Allocations & Usage
            </h2>
            <p className="text-xs text-muted-foreground">
              Showing {filteredSchools.length} of {schools.length} schools
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["ALL", ...PLAN_IDS].map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setSelectedPlanFilter(tier)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedPlanFilter === tier
                    ? "bg-violet-600 text-white"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground"
                }`}
              >
                {tier === "ALL" ? tier : planName(tier)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground uppercase text-[10px]">
                <th className="h-9 px-4 text-left font-medium">School</th>
                <th className="h-9 px-3 text-left font-medium">Subdomain</th>
                <th className="h-9 px-3 text-left font-medium">Current Plan</th>
                <th className="h-9 px-3 text-left font-medium">
                  Student Usage
                </th>
                <th className="h-9 px-3 text-left font-medium">
                  Teacher Usage
                </th>
                <th className="h-9 px-4 text-right font-medium">Change Tier</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-foreground">
                    {s.name}
                  </td>
                  <td className="py-3 px-3 font-mono text-muted-foreground">
                    {s.subdomain}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                      {planName(s.plan)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-muted-foreground">
                      {s.studentCount} /{" "}
                      {s.maxStudents === Infinity ? "Unlimited" : s.maxStudents}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-muted-foreground">
                      {s.teacherCount} /{" "}
                      {s.maxTeachers === Infinity ? "Unlimited" : s.maxTeachers}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      aria-label="Change school subscription tier"
                      value={s.plan}
                      onChange={(e) =>
                        setPlanTarget({ school: s, plan: e.target.value })
                      }
                      className="h-7 px-2 border rounded-md text-[11px] bg-background font-medium focus:ring-1 focus:ring-violet-500"
                    >
                      {PLAN_IDS.map((id) => (
                        <option key={id} value={id}>
                          {planName(id)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!planTarget}
        onOpenChange={(open) => {
          if (!open) setPlanTarget(null);
        }}
        title="Update Subscription Tier"
        description={`Are you sure you want to change "${planTarget?.school.name}" to the ${planTarget ? planName(planTarget.plan) : ""} plan? Limit caps will be adjusted immediately.`}
        confirmLabel="Update Plan"
        onConfirm={handlePlanChange}
      />

      {editingPlan && (
        <PlanEditorDialog
          plan={plans[editingPlan]}
          schoolCount={planCounts[editingPlan] ?? 0}
          open
          onOpenChange={(open) => {
            if (!open) setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
}
