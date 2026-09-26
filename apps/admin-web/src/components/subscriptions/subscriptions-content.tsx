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
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
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
  schools: SchoolSubItem[];
  planCounts: Record<string, number>;
}

const PLANS_CONFIG = [
  {
    id: "FREE",
    name: "Free Tier",
    price: 0,
    period: "/mo",
    description: "Ideal for small coaching centers and trial setups",
    maxStudents: "50 Students",
    maxTeachers: "5 Teachers",
    maxClasses: "5 Classes",
    features: [
      "Student & Teacher Directory",
      "Daily Attendance",
      "Standard Fee Receipts",
      "Notice Board",
      "Community Support",
    ],
    highlight: false,
    badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  {
    id: "BASIC",
    name: "Basic Plan",
    price: 999,
    period: "/mo",
    description: "Designed for growing primary & middle schools",
    maxStudents: "200 Students",
    maxTeachers: "20 Teachers",
    maxClasses: "20 Classes",
    features: [
      "Everything in Free",
      "Class-wise Fee Structures",
      "Automated Fee Receipts & Dues",
      "Homework & Assignments",
      "Email Support (24h SLA)",
    ],
    highlight: false,
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    id: "PRO",
    name: "Pro Plan",
    price: 2499,
    period: "/mo",
    description: "Full-featured ERP suite for established schools",
    maxStudents: "1,000 Students",
    maxTeachers: "100 Teachers",
    maxClasses: "60 Classes",
    features: [
      "Everything in Basic",
      "Advanced Analytics & Trends",
      "Expense & Cash Flow Tracking",
      "Online Payment Gateway Integration",
      "Priority Chat & Phone Support",
    ],
    highlight: true,
    badgeColor:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 4999,
    period: "/mo",
    description: "Custom branding and scale for large school networks",
    maxStudents: "Unlimited Students",
    maxTeachers: "Unlimited Teachers",
    maxClasses: "Unlimited Classes",
    features: [
      "Everything in Pro",
      "Multi-Branch Administration",
      "Custom Subdomain & White-Labeling",
      "Dedicated Database Isolation",
      "Dedicated Account Manager (99.9% SLA)",
    ],
    highlight: false,
    badgeColor:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
];

export function SubscriptionsContent({
  schools,
  planCounts,
}: Readonly<SubscriptionsContentProps>) {
  const router = useRouter();
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
    (acc, [plan, count]) => {
      const config = PLANS_CONFIG.find((p) => p.id === plan);
      return acc + (config ? config.price * count : 0);
    },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS_CONFIG.map((plan) => {
          const count = planCounts[plan.id] ?? 0;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border bg-card p-5 flex flex-col justify-between transition-all relative ${
                plan.highlight
                  ? "border-violet-400 ring-2 ring-violet-500/20 shadow-md"
                  : "border-border hover:border-violet-300 dark:hover:border-violet-800"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${plan.badgeColor}`}
                  >
                    {plan.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {count} {count === 1 ? "School" : "Schools"}
                  </span>
                </div>

                <div className="mt-4 mb-2">
                  <span className="text-3xl font-extrabold text-foreground">
                    {plan.price === 0 ? "Free" : formatCurrency(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground min-h-[32px]">
                  {plan.description}
                </p>

                <div className="my-4 py-3 border-y space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>Student Limit:</span>
                    <span className="font-semibold">{plan.maxStudents}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>Teacher Limit:</span>
                    <span className="font-semibold">{plan.maxTeachers}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>Class Limit:</span>
                    <span className="font-semibold">{plan.maxClasses}</span>
                  </div>
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

              <button
                type="button"
                onClick={() =>
                  setSelectedPlanFilter(
                    plan.id === selectedPlanFilter ? "ALL" : plan.id,
                  )
                }
                className={`w-full h-8 text-xs font-semibold rounded-lg transition-colors border ${
                  selectedPlanFilter === plan.id
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-muted/50 text-foreground hover:bg-muted"
                }`}
              >
                {selectedPlanFilter === plan.id
                  ? "Showing Enrolled Schools"
                  : `Filter by ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Schools Subscription Table */}
      <div className="rounded-xl border bg-card overflow-hidden space-y-0">
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
            {["ALL", "FREE", "BASIC", "PRO", "ENTERPRISE"].map((tier) => (
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
                {tier}
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
                      {s.plan}
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
                      <option value="FREE">FREE</option>
                      <option value="BASIC">BASIC</option>
                      <option value="PRO">PRO</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
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
        description={`Are you sure you want to change "${planTarget?.school.name}" to the ${planTarget?.plan} plan? Limit caps will be adjusted immediately.`}
        confirmLabel="Update Plan"
        onConfirm={handlePlanChange}
      />
    </div>
  );
}
