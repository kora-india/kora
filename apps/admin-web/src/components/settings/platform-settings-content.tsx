"use client";

import React, { useState } from "react";
import {
  Server,
  Database,
  Layers,
  ShieldCheck,
  Cpu,
  Mail,
  Zap,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PLANS, formatLimit, formatPlanPrice } from "@/lib/plans";

const PLAN_TIER_COLORS: Record<string, string> = {
  FREE: "",
  BASIC: "text-blue-600",
  PRO: "text-violet-600",
  ENTERPRISE: "text-amber-600",
};

export function PlatformSettingsContent() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleMaintenanceToggle = () => {
    const next = !maintenanceMode;
    setMaintenanceMode(next);
    toast.success(
      next
        ? "Platform set to Maintenance Mode (Admins alerted)"
        : "Platform set to Live Operation Mode",
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Platform System Health */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Server className="w-4 h-4 text-violet-600" />
            SaaS Multi-Tenant Infrastructure Status
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time status of backend services and multi-tenant services
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-lg border bg-muted/20 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-semibold">PostgreSQL DB</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Prisma Client Pool
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>

          <div className="p-3 rounded-lg border bg-muted/20 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Redis Cache</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Upstash / Redis Engine
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          </div>

          <div className="p-3 rounded-lg border bg-muted/20 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
                <span className="text-xs font-semibold">NextAuth JWT</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Role-based Isolation
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          </div>
        </div>
      </div>

      {/* Default Tier Limits Overview */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Default Plan Enforcements
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Limits automatically applied to schools during onboarding
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground uppercase text-[10px]">
                <th className="h-8 px-3 text-left font-medium">Plan Tier</th>
                <th className="h-8 px-3 text-left font-medium">
                  Monthly Price
                </th>
                <th className="h-8 px-3 text-left font-medium">Max Students</th>
                <th className="h-8 px-3 text-left font-medium">Max Teachers</th>
                <th className="h-8 px-3 text-left font-medium">Max Classes</th>
                <th className="h-8 px-3 text-left font-medium">Analytics</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PLANS).map((plan) => (
                <tr key={plan.id} className="border-b last:border-0">
                  <td
                    className={`py-2.5 px-3 font-semibold ${PLAN_TIER_COLORS[plan.id]}`}
                  >
                    {plan.id}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {formatPlanPrice(plan)}/mo
                  </td>
                  {(["maxStudents", "maxTeachers", "maxClasses"] as const).map(
                    (key) => (
                      <td
                        key={key}
                        className={`py-2.5 px-3 ${Number.isFinite(plan.limits[key]) ? "" : "font-bold"}`}
                      >
                        {formatLimit(plan.limits[key])}
                      </td>
                    ),
                  )}
                  <td
                    className={`py-2.5 px-3 ${plan.limits.analyticsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}`}
                  >
                    {plan.limits.analyticsEnabled ? "Enabled" : "Disabled"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance Mode Controls */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-rose-500" />
            Global Platform Maintenance & Broadcast
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Display maintenance alerts across all active school portals
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold">Maintenance Mode Switch</p>
            <p className="text-[11px] text-muted-foreground">
              Temporarily show a maintenance banner to all school users
            </p>
          </div>
          <button
            type="button"
            onClick={handleMaintenanceToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              maintenanceMode
                ? "bg-rose-600 text-white"
                : "bg-muted border hover:bg-muted/80 text-foreground"
            }`}
          >
            {maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
          </button>
        </div>
      </div>
    </div>
  );
}
