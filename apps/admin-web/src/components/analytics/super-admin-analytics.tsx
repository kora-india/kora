"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  GraduationCap,
  CreditCard,
  Layers,
  ArrowRight,
  Sparkles,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import { AntvPlanDonutChart } from "@/components/analytics/antv-charts";

interface SuperAdminAnalyticsProps {
  totalSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalStaff: number;
  moduleAdoption: {
    module: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  monthlyVolume: {
    month: string;
    volume: number;
  }[];
  plans: {
    name: string;
    count: number;
    percentage: number;
  }[];
}

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

export function SuperAdminAnalytics({
  totalSchools,
  totalStudents,
  totalTeachers,
  totalStaff,
  moduleAdoption,
  monthlyVolume,
  plans,
}: Readonly<SuperAdminAnalyticsProps>) {
  const planChartData = plans.map((p) => ({
    name: `${p.name} (${p.count})`,
    value: p.count,
  }));

  const totalGrossVolume = monthlyVolume.reduce(
    (acc, curr) => acc + curr.volume,
    0,
  );
  const avgStudentsPerSchool =
    totalSchools > 0 ? Math.round(totalStudents / totalSchools) : 0;

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Platform Analytics
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Aggregated multi-tenant metrics across all registered schools in
            Kora
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/schools"
            className="flex items-center gap-1.5 h-9 px-3.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Manage Schools</span>
          </Link>
        </div>
      </div>

      {/* Top Aggregates */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <motion.div
          variants={stagger.item}
          className="rounded-xl border bg-card p-4 space-y-1"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Registered Schools</span>
            <Building2 className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl font-bold">{totalSchools}</p>
          <p className="text-[11px] text-muted-foreground">
            Active multi-tenant instances
          </p>
        </motion.div>

        <motion.div
          variants={stagger.item}
          className="rounded-xl border bg-card p-4 space-y-1"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Platform Students</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{totalStudents.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground">
            ~{avgStudentsPerSchool} avg per school
          </p>
        </motion.div>

        <motion.div
          variants={stagger.item}
          className="rounded-xl border bg-card p-4 space-y-1"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Educators & Staff</span>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold">
            {(totalTeachers + totalStaff).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {totalTeachers} teachers · {totalStaff} staff
          </p>
        </motion.div>

        <motion.div
          variants={stagger.item}
          className="rounded-xl border bg-card p-4 space-y-1"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Gross Fee Volume</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(totalGrossVolume)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Past 6 months processed
          </p>
        </motion.div>
      </motion.div>

      {/* Middle Grid: Module Adoption & Tier Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Module Adoption Matrix */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-600" />
              Feature & Module Adoption
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Percentage of schools actively using core modules
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {moduleAdoption.map((item) => (
              <div key={item.module} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {item.module}
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {item.count} / {totalSchools} schools ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-2 rounded-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Plan Distribution */}
        <div className="rounded-xl border bg-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Subscription Plan Breakdown
              </h2>
              <Link
                href="/subscriptions"
                className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline flex items-center gap-1"
              >
                Pricing <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribution of schools across active billing tiers
            </p>
          </div>

          <div className="py-2">
            {planChartData.length > 0 ? (
              <AntvPlanDonutChart data={planChartData} height={210} />
            ) : (
              <div className="h-[210px] flex items-center justify-center text-xs text-muted-foreground">
                No active plans
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
            {plans.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/40"
              >
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-bold">{p.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Platform Fee Volume Breakdown */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Platform Fee Volume by Month
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aggregate tuition and fee payments processed across all school
              tenants
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
            Total {formatCurrency(totalGrossVolume)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
          {monthlyVolume.map((m) => (
            <div
              key={m.month}
              className="p-3 rounded-lg border bg-muted/20 text-center space-y-1"
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {m.month}
              </p>
              <p className="text-sm font-bold text-foreground">
                {formatCurrency(m.volume)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
