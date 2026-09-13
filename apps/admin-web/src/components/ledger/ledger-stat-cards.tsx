"use client";

import React from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@schoolos/utils";
import {
  IndianRupee,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  PiggyBank,
  AlertCircle,
  Activity,
  CreditCard,
  QrCode,
  Building2,
  FileCheck2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  ReceiptText,
} from "lucide-react";

export interface LedgerMetrics {
  // Master Totals
  totalInflow: number;
  inflowCount: number;
  avgInflow: number;

  totalOutflow: number;
  outflowCount: number;
  avgOutflow: number;

  netPosition: number;

  totalAdvanceBalance: number;
  advanceEntriesCount: number;

  totalReceivables: number;
  totalBilledFees: number;
  collectionRate: number;

  totalTransactionsCount: number;
  activePeriodDays: number;

  // Payment Methods Breakdown
  methodStats: {
    cash: { inflow: number; outflow: number; net: number; count: number };
    upi: { inflow: number; count: number };
    bankTransfer: { inflow: number; count: number };
    cheque: { inflow: number; count: number };
    card: { inflow: number; count: number };
    other: { inflow: number; count: number };
  };

  // Fee Component Distribution
  componentDistribution: {
    id: string;
    name: string;
    category?: string;
    amount: number;
    percentage: number;
    count: number;
  }[];

  // Expense Category Distribution
  categoryDistribution: {
    id: string;
    name: string;
    amount: number;
    percentage: number;
    count: number;
  }[];

  // Class Level Breakdown
  classBreakdown: {
    classId: string;
    className: string;
    grade: number;
    collectedAmount: number;
    receivables: number;
    transactionCount: number;
    recoveryRate: number;
  }[];
}

interface LedgerStatCardsProps {
  metrics: LedgerMetrics;
}

export function LedgerStatCards({ metrics }: Readonly<LedgerStatCardsProps>) {
  const isNetPositive = metrics.netPosition >= 0;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: MASTER FINANCIAL POSITION (6 HERO KPI CARDS)        */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Scale className="w-4 h-4 text-violet-600" />
            Executive Financial Position
          </h2>
          <span className="text-[11px] font-medium text-muted-foreground">
            Calculated across {metrics.totalTransactionsCount} financial events
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* 1. Gross Collections / Inflow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border bg-card p-4 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Collections
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {formatCurrency(metrics.totalInflow)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                <span>{metrics.inflowCount} receipts</span>
                <span>Avg {formatCurrency(metrics.avgInflow)}</span>
              </div>
            </div>
          </motion.div>

          {/* 2. Total Outflow / Expenses */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.04 }}
            className="rounded-2xl border bg-card p-4 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Expenses
              </span>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {formatCurrency(metrics.totalOutflow)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                <span>{metrics.outflowCount} vouchers</span>
                <span>Avg {formatCurrency(metrics.avgOutflow)}</span>
              </div>
            </div>
          </motion.div>

          {/* 3. Net Financial Position (Surplus / Deficit) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.08 }}
            className="rounded-2xl border bg-card p-4 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Net Cash Balance
              </span>
              <div
                className={`p-2 rounded-xl ${
                  isNetPositive
                    ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
                    : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                }`}
              >
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p
                className={`text-2xl font-black tracking-tight ${
                  isNetPositive
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(metrics.netPosition)}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-medium mt-1">
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    isNetPositive
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {isNetPositive ? "SURPLUS" : "DEFICIT"}
                </span>
                <span className="text-muted-foreground truncate">
                  Inflow vs Outflow
                </span>
              </div>
            </div>
          </motion.div>

          {/* 4. Customer Advance Balance Pool */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.12 }}
            className="rounded-2xl border bg-card p-4 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Advance Pool
              </span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <PiggyBank className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {formatCurrency(metrics.totalAdvanceBalance)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                <span>{metrics.advanceEntriesCount} ledger entries</span>
                <span className="text-amber-600 font-semibold">
                  Prepaid Dues
                </span>
              </div>
            </div>
          </motion.div>

          {/* 5. Outstanding Receivables & Recovery Rate */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.16 }}
            className="rounded-2xl border bg-card p-4 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Outstanding Dues
              </span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-foreground tracking-tight">
                {formatCurrency(metrics.totalReceivables)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                <span className="text-emerald-600 font-semibold">
                  {metrics.collectionRate}% collected
                </span>
                <span>of {formatCurrency(metrics.totalBilledFees)}</span>
              </div>
            </div>
          </motion.div>

          {/* 6. Transaction Count & Velocity */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
            className="rounded-2xl border bg-card p-4 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Financial Events
              </span>
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-foreground tracking-tight">
                {metrics.totalTransactionsCount}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                <span>
                  {metrics.activePeriodDays > 0
                    ? (
                        metrics.totalTransactionsCount /
                        metrics.activePeriodDays
                      ).toFixed(1)
                    : metrics.totalTransactionsCount}{" "}
                  events/day
                </span>
                <span className="font-mono text-emerald-600 font-semibold">
                  100% Verified
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: PAYMENT CHANNEL & LIQUIDITY BREAKDOWN CARDS        */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-violet-600" />
            Payment Channel & Liquidity Breakdown
          </h2>
          <span className="text-[11px] font-medium text-muted-foreground">
            Cash, Digital, Bank Wire & Cheques
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Cash Ledger Position */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Physical Cash
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Cash in Hand Ledger
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {metrics.methodStats.cash.count} txns
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cash Collected:</span>
                <span className="font-bold text-emerald-600">
                  +{formatCurrency(metrics.methodStats.cash.inflow)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cash Disbursed:</span>
                <span className="font-bold text-rose-600">
                  -{formatCurrency(metrics.methodStats.cash.outflow)}
                </span>
              </div>
              <div className="border-t pt-1.5 flex justify-between text-xs font-bold">
                <span>Net Cash In-Hand:</span>
                <span
                  className={
                    metrics.methodStats.cash.net >= 0
                      ? "text-violet-600 font-black"
                      : "text-red-600 font-black"
                  }
                >
                  {formatCurrency(metrics.methodStats.cash.net)}
                </span>
              </div>
            </div>
          </div>

          {/* UPI & Instant Digital */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    UPI & QR Pay
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Instant Gateway / VPA
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {metrics.methodStats.upi.count} txns
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-2xl font-black text-foreground">
                {formatCurrency(metrics.methodStats.upi.inflow)}
              </p>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Share of collections:</span>
                <span className="font-semibold text-foreground">
                  {metrics.totalInflow > 0
                    ? Math.round(
                        (metrics.methodStats.upi.inflow / metrics.totalInflow) *
                          100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      metrics.totalInflow > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (metrics.methodStats.upi.inflow /
                                metrics.totalInflow) *
                                100,
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bank Transfers & Cards */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Bank Wire & Cards
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    NEFT, RTGS, IMPS, POS
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                {metrics.methodStats.bankTransfer.count +
                  metrics.methodStats.card.count}{" "}
                txns
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-2xl font-black text-foreground">
                {formatCurrency(
                  metrics.methodStats.bankTransfer.inflow +
                    metrics.methodStats.card.inflow,
                )}
              </p>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Direct Bank Inflow:</span>
                <span className="font-semibold text-foreground">
                  {metrics.totalInflow > 0
                    ? Math.round(
                        ((metrics.methodStats.bankTransfer.inflow +
                          metrics.methodStats.card.inflow) /
                          metrics.totalInflow) *
                          100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      metrics.totalInflow > 0
                        ? Math.min(
                            100,
                            Math.round(
                              ((metrics.methodStats.bankTransfer.inflow +
                                metrics.methodStats.card.inflow) /
                                metrics.totalInflow) *
                                100,
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cheques & Clearing */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Cheque & DD
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Clearing / Instruments
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                {metrics.methodStats.cheque.count} txns
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-2xl font-black text-foreground">
                {formatCurrency(metrics.methodStats.cheque.inflow)}
              </p>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Instrument Collections:</span>
                <span className="font-semibold text-foreground">
                  {metrics.totalInflow > 0
                    ? Math.round(
                        (metrics.methodStats.cheque.inflow /
                          metrics.totalInflow) *
                          100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      metrics.totalInflow > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (metrics.methodStats.cheque.inflow /
                                metrics.totalInflow) *
                                100,
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 3: REVENUE COMPONENTS & EXPENSE CATEGORIES GRIDS       */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Fee Component Breakdown Card */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-violet-600" />
                Fee Component Distribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verified collections allocated per fee category
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              {metrics.componentDistribution.length} Components
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {metrics.componentDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No fee component allocations in this filtered range.
              </p>
            ) : (
              metrics.componentDistribution.map((comp) => (
                <div key={comp.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      {comp.name}
                      {comp.category === "LATE_FEE" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                          FINE
                        </span>
                      )}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-foreground">
                        {formatCurrency(comp.amount)}
                      </span>
                      <span className="text-muted-foreground ml-1.5 text-[11px]">
                        ({comp.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-violet-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, comp.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expense Category Breakdown Card */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-rose-600" />
                Operational Expense Categories
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                School operational expenditures breakdown
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {metrics.categoryDistribution.length} Categories
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {metrics.categoryDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No expense records recorded in this filtered range.
              </p>
            ) : (
              metrics.categoryDistribution.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {cat.name}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-foreground">
                        {formatCurrency(cat.amount)}
                      </span>
                      <span className="text-muted-foreground ml-1.5 text-[11px]">
                        ({cat.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4: CLASS & GRADE LEVEL RECOVERY INTELLIGENCE CARDS     */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            Class & Grade Collection Intelligence
          </h2>
          <span className="text-[11px] font-medium text-muted-foreground">
            Ranked by recovery efficiency
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {metrics.classBreakdown.length === 0 ? (
            <div className="col-span-full rounded-2xl border bg-card p-6 text-center text-xs text-muted-foreground">
              No class-specific collections found for the active filter
              selection.
            </div>
          ) : (
            metrics.classBreakdown.slice(0, 8).map((cls) => (
              <div
                key={cls.classId}
                className="rounded-2xl border bg-card p-4 shadow-sm space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">
                    {cls.className}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      cls.recoveryRate >= 80
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : cls.recoveryRate >= 50
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}
                  >
                    {cls.recoveryRate}% Recovery
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collected:</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(cls.collectedAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending Dues:</span>
                    <span className="font-medium text-muted-foreground">
                      {formatCurrency(cls.receivables)}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cls.recoveryRate >= 80
                        ? "bg-emerald-500"
                        : cls.recoveryRate >= 50
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(100, cls.recoveryRate)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5: AUDIT SEAL & SOURCE OF TRUTH VERIFICATION BANNER    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/50 via-background to-emerald-50/40 dark:from-violet-950/20 dark:via-background dark:to-emerald-950/20 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600 text-white shadow-sm flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              Source of Truth Verification
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              This ledger is non-editable and mathematically reconciled against
              student payment receipts, advance adjustment credits, and approved
              school expense vouchers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-muted-foreground font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Reconciled Live
        </div>
      </div>
    </div>
  );
}
