"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  GraduationCap,
  TrendingUp,
  CreditCard,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import {
  AntvPlanDonutChart,
  AntvSchoolGrowthColumnChart,
} from "@/components/analytics/antv-charts";

const stagger = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: "easeOut" },
    },
  },
};

const PLAN_BADGE: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700",
  BASIC:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  PRO: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  ENTERPRISE:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
};

interface SuperAdminDashboardProps {
  data: {
    stats: {
      totalSchools: number;
      activeSchools: number;
      suspendedSchools: number;
      totalStudents: number;
      totalTeachers: number;
      totalClasses: number;
      estimatedMRR: number;
      estimatedARR: number;
      totalFeeVolume: number;
      totalTransactionsCount: number;
    };
    planDistribution: {
      name: string;
      plan: string;
      count: number;
      value: number;
      price: number;
    }[];
    recentSchools: {
      id: string;
      name: string;
      subdomain: string;
      email: string | null;
      phone: string | null;
      plan: string;
      isActive: boolean;
      createdAt: string;
      studentCount: number;
      teacherCount: number;
      maxStudents: number;
      usagePercent: number;
    }[];
    schoolsNearLimit: {
      id: string;
      name: string;
      plan: string;
      current: number;
      max: number;
      percent: number;
    }[];
    onboardingGrowth: {
      month: string;
      schools: number;
      mrr: number;
    }[];
  };
  userName?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtext,
  badge,
  color,
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtext?: string;
  badge?: { label: string; positive: boolean };
  color: string;
  href?: string;
}) {
  const content = (
    <motion.div
      variants={stagger.item}
      className="rounded-xl border bg-card p-4 hover:shadow-md transition-all hover:border-violet-300 dark:hover:border-violet-700 flex flex-col justify-between h-full group"
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {href && (
          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {badge && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                badge.positive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
              }`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
          {title}
        </p>
        {subtext && (
          <p className="text-[11px] text-muted-foreground/80 mt-1">{subtext}</p>
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export function SuperAdminDashboardContent({
  data,
  userName,
}: Readonly<SuperAdminDashboardProps>) {
  const stats = data.stats;
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
        ? "Good afternoon"
        : "Good evening";

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const planChartData = data.planDistribution.map((p) => ({
    name: `${p.plan} (${p.count})`,
    value: p.count,
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            {greeting}, {userName ?? "Super Admin"}{" "}
            <span className="animate-pulse">✨</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>Kora SaaS Platform Management</span>
            <span>·</span>
            <span>{todayFormatted}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/schools"
            className="flex items-center gap-1.5 h-9 px-3.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Onboard School</span>
          </Link>
          <Link
            href="/subscriptions"
            className="flex items-center gap-1.5 h-9 px-3.5 bg-card border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span>Manage Plans</span>
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 h-9 px-3.5 bg-card border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Platform Analytics</span>
          </Link>
        </div>
      </div>

      {/* Top SaaS KPI Cards */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <StatCard
          title="Total Schools"
          value={stats.totalSchools}
          icon={Building2}
          color="bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
          subtext={`${stats.activeSchools} Active · ${stats.suspendedSchools} Suspended`}
          badge={{ label: `${stats.activeSchools} Active`, positive: true }}
          href="/schools"
        />

        <StatCard
          title="Estimated MRR"
          value={formatCurrency(stats.estimatedMRR)}
          icon={CreditCard}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
          subtext={`${formatCurrency(stats.estimatedARR)} Annualized`}
          href="/subscriptions"
        />

        <StatCard
          title="Platform Students"
          value={stats.totalStudents.toLocaleString()}
          icon={Users}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
          subtext="Active enrollments"
          href="/analytics"
        />

        <StatCard
          title="Teachers & Staff"
          value={stats.totalTeachers.toLocaleString()}
          icon={GraduationCap}
          color="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
          subtext={`${stats.totalClasses} total classes`}
        />

        <StatCard
          title="Fee Volume Processed"
          value={formatCurrency(stats.totalFeeVolume)}
          icon={TrendingUp}
          color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
          subtext={`${stats.totalTransactionsCount} transactions`}
          href="/analytics"
        />

        <StatCard
          title="System Health"
          value="100%"
          icon={ShieldCheck}
          color="bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400"
          subtext="All multi-tenant nodes up"
          badge={{ label: "Healthy", positive: true }}
        />
      </motion.div>

      {/* Middle Row: Visual SaaS Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* School Onboarding Growth Chart (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-600" />
                School Onboarding & Growth Trend
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                New school registrations across past 6 months
              </p>
            </div>
            <Link
              href="/schools"
              className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline flex items-center gap-1"
            >
              View all schools <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="pt-2">
            <AntvSchoolGrowthColumnChart
              data={data.onboardingGrowth}
              height={230}
            />
          </div>
        </div>

        {/* Subscription Plan Distribution (1 Col) */}
        <div className="rounded-xl border bg-card p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Subscription Tiers
              </h2>
              <Link
                href="/subscriptions"
                className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline"
              >
                Pricing
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribution of active tenant plans
            </p>
          </div>

          <div className="py-1">
            {planChartData.length > 0 ? (
              <AntvPlanDonutChart data={planChartData} height={200} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                No active subscriptions
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
            {data.planDistribution.map((p) => (
              <div
                key={p.plan}
                className="flex items-center justify-between px-2 py-1 rounded bg-muted/40"
              >
                <span className="text-muted-foreground">{p.plan}:</span>
                <span className="font-semibold">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Schools & Attention Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Schools Table (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Recently Registered Schools
              </h2>
              <p className="text-xs text-muted-foreground">
                Latest school tenants onboarded to the platform
              </p>
            </div>
            <Link
              href="/schools"
              className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline flex items-center gap-1"
            >
              Manage schools <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground uppercase text-[10px]">
                  <th className="h-9 px-4 text-left font-medium">School</th>
                  <th className="h-9 px-3 text-left font-medium">Subdomain</th>
                  <th className="h-9 px-3 text-left font-medium">Plan</th>
                  <th className="h-9 px-3 text-left font-medium">Capacity</th>
                  <th className="h-9 px-3 text-left font-medium">Status</th>
                  <th className="h-9 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSchools.length > 0 ? (
                  data.recentSchools.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {s.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {s.email ?? s.phone ?? "No contact"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {s.subdomain}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            PLAN_BADGE[s.plan] ?? PLAN_BADGE.FREE
                          }`}
                        >
                          {s.plan}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1 w-24">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{s.studentCount}</span>
                            <span>
                              {s.maxStudents === Infinity ? "∞" : s.maxStudents}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                s.usagePercent > 85
                                  ? "bg-red-500"
                                  : s.usagePercent > 60
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${Math.max(4, s.usagePercent)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {s.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                            <XCircle className="w-3 h-3" /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/schools?search=${encodeURIComponent(s.subdomain)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/40 transition-colors"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No schools registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quota Alerts & SaaS Highlights (1 Col) */}
        <div className="space-y-4">
          {/* Schools Near Limit Warning Card */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Capacity & Plan Alerts
              </h2>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {data.schoolsNearLimit.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Schools nearing student limits ({">"}80% capacity)
            </p>

            <div className="space-y-2 pt-1">
              {data.schoolsNearLimit.length > 0 ? (
                data.schoolsNearLimit.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {item.name}
                      </p>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        {item.percent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {item.current} / {item.max} students ({item.plan})
                      </span>
                      <Link
                        href={`/schools?search=${encodeURIComponent(item.name)}`}
                        className="text-violet-600 font-semibold hover:underline"
                      >
                        Upgrade Plan
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  All schools are operating well within their plan limits.
                </div>
              )}
            </div>
          </div>

          {/* SaaS Super Admin Shortcuts */}
          <div className="rounded-xl border bg-gradient-to-br from-violet-600 to-indigo-700 p-4 text-white space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-100">
                Super Admin Tips
              </h3>
            </div>
            <p className="text-xs text-violet-100 leading-relaxed">
              Use the <strong>Schools</strong> directory to manage individual
              tenants or change subscription tiers to unlock higher student
              limits.
            </p>
            <div className="pt-1">
              <Link
                href="/schools"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-bold rounded-lg hover:bg-violet-50 transition-colors shadow-sm"
              >
                Go to Schools Directory <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
