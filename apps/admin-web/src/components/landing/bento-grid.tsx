"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  Smartphone,
  Bus,
  Award,
  Zap,
  CheckCircle2,
  TrendingUp,
  Clock,
  Shield,
  Layers,
  Sparkles,
  ArrowUpRight,
  UserCheck,
  Calendar,
  DollarSign,
  Activity,
  MapPin,
  Users,
} from "lucide-react";

export function BentoGrid() {
  // Interactive state for Finance card demo
  const [feeCollected, setFeeCollected] = useState(false);

  // Interactive state for Attendance PWA card demo
  const [studentsAttendance, setStudentsAttendance] = useState([
    { id: 1, name: "Aarav Sharma", roll: "101", status: "PRESENT" },
    { id: 2, name: "Diya Patel", roll: "102", status: "PRESENT" },
    { id: 3, name: "Kabir Verma", roll: "103", status: "ABSENT" },
    { id: 4, name: "Sanya Gupta", roll: "104", status: "PRESENT" },
  ]);

  const toggleAttendance = (id: number) => {
    setStudentsAttendance((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status:
                s.status === "PRESENT"
                  ? "ABSENT"
                  : s.status === "ABSENT"
                  ? "LATE"
                  : "PRESENT",
            }
          : s
      )
    );
  };

  const presentCount = studentsAttendance.filter(
    (s) => s.status === "PRESENT"
  ).length;
  const attendanceRate = Math.round(
    (presentCount / studentsAttendance.length) * 100
  );

  return (
    <section id="bento-overview" className="py-24 relative overflow-hidden">
      {/* Background Lighting */}
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Architecture & Modules</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Designed for Modern Schools.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
              Engineered for Scale.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/60">
            Every module in SchoolOS is built to communicate seamlessly in real-time, eliminating data duplication and manual work.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* ─────────────────────────────────────────────────────────────
              CARD 1: Real-Time Financial Hub (Span 2 Cols on Large)
             ───────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-violet-500/40 transition-all duration-300 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <CreditCard className="w-32 h-32 text-violet-400" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                  Financial Engine & Advance Ledger
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Automated Allocation & Advance Tracking
              </h3>
              <p className="text-sm sm:text-base text-white/60 max-w-xl mb-6">
                Say goodbye to manual fee reconciliation. SchoolOS automatically deducts advance ledgers, adjusts transport fares, and calculates exact net payable balances.
              </p>
            </div>

            {/* Interactive Skeleton Preview */}
            <div className="mt-4 p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">Student:</span>
                  <span className="text-xs text-violet-300 font-bold">Aarav Sharma (Class 8 · A)</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    feeCollected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {feeCollected ? "FULLY SETTLED" : "PARTIAL DUE"}
                </span>
              </div>

              {/* Table of Due Breakdown */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 border-b border-white/5 pb-1 text-left">
                      <th className="pb-1 font-medium">Charge</th>
                      <th className="pb-1 text-right font-medium">Net Charge</th>
                      <th className="pb-1 text-right font-medium">Advance Paid</th>
                      <th className="pb-1 text-right font-medium">Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="py-2 font-medium text-white/80">Tuition & Lab Fee (Aug)</td>
                      <td className="py-2 text-right text-white">₹2,200</td>
                      <td className="py-2 text-right text-emerald-400 font-medium">-₹800</td>
                      <td className="py-2 text-right font-bold text-amber-400">
                        {feeCollected ? "₹0" : "₹1,400"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-white/80">Bus Transport (Route 4)</td>
                      <td className="py-2 text-right text-white">₹750</td>
                      <td className="py-2 text-right text-emerald-400 font-medium">₹0</td>
                      <td className="py-2 text-right font-bold text-amber-400">
                        {feeCollected ? "₹0" : "₹750"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                <div className="text-xs text-white/60 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                  <span>Auto-Settlement Ref: ADV-2026-97792</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeeCollected(!feeCollected)}
                  className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                    feeCollected
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {feeCollected ? "Reset Simulation" : "Collect Remaining ₹2,150"}
                </button>
              </div>
            </div>
          </motion.div>

          {/* ─────────────────────────────────────────────────────────────
              CARD 2: Teacher Mobile PWA (1 Col)
             ───────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-emerald-500/40 transition-all duration-300 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Teacher PWA
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                20-Second Roll Call
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mb-6">
                Teachers mark attendance in seconds directly from mobile with instant parent WhatsApp alert triggers.
              </p>
            </div>

            {/* Interactive Phone Screen Simulator */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">Class 8 · Sec A</span>
                  <p className="text-[10px] text-white/40">Tap chip to toggle state</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-emerald-400">
                    {attendanceRate}%
                  </span>
                  <span className="text-[10px] text-white/40 block">Present</span>
                </div>
              </div>

              {/* Roster List */}
              <div className="space-y-1.5">
                {studentsAttendance.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => toggleAttendance(s.id)}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center">
                        {s.roll.slice(-2)}
                      </span>
                      <span className="text-xs font-medium text-white/90">{s.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        s.status === "PRESENT"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : s.status === "ABSENT"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ─────────────────────────────────────────────────────────────
              CARD 3: Fleet & Transport Management (1 Col)
             ───────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-amber-500/40 transition-all duration-300 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Bus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Fleet & Logistics
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Distance Route Billing
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mb-6">
                Automated per-km or flat fee multipliers with live bus capacity gauges and driver passenger manifests.
              </p>
            </div>

            {/* Transport Card Simulator */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Route 4 - Sector 62</h4>
                  <p className="text-[10px] text-amber-400 font-medium">Bus #04 • 42 Seater</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  ACTIVE
                </span>
              </div>

              {/* Capacity Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] text-white/60 mb-1">
                  <span>Occupancy</span>
                  <span className="font-semibold text-white">35 / 42 Seats (83%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-[83%]" />
                </div>
              </div>

              {/* Stop Distance Example */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-white/80">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sector 62 (8.5 km)</span>
                </div>
                <span className="font-bold text-amber-300">₹850 / mo</span>
              </div>
            </div>
          </motion.div>

          {/* ─────────────────────────────────────────────────────────────
              CARD 4: Multi-Section Teacher Mapping (1 Col)
             ───────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-purple-500/40 transition-all duration-300 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Academic Organization
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Multi-Class Teachers
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mb-6">
                Assign teachers across multiple classes and sections with dedicated Class Teacher credentials.
              </p>
            </div>

            {/* Teacher Card Simulator */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  AV
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Dr. Ananya Verma</h4>
                  <p className="text-[10px] text-white/50">Mathematics HOD</p>
                </div>
              </div>

              {/* Designation Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                <Award className="w-3.5 h-3.5" />
                <span>Class Teacher: Grade 8</span>
              </div>

              {/* Multi-Section Tags */}
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-medium border border-white/10">
                  8 · Section A
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-medium border border-white/10">
                  8 · Section B
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-medium border border-white/10">
                  9 · Section A
                </span>
              </div>
            </div>
          </motion.div>

          {/* ─────────────────────────────────────────────────────────────
              CARD 5: Sub-5ms Cloud Database & Redis Speed (Span 2 Cols on Large)
             ───────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-2 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-indigo-500/40 transition-all duration-300 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  High Performance Infrastructure
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Sub-5ms Cloud Speed with Redis & Composite Indexing
              </h3>
              <p className="text-sm sm:text-base text-white/60 max-w-xl mb-6">
                Built on PostgreSQL compound indexes and Upstash Redis. Handles 10,000+ students and concurrent fee generations without lag.
              </p>
            </div>

            {/* Performance Meter Simulator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-black/50 border border-white/10">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-white/50 block mb-1">Redis In-Memory Cache</span>
                <span className="text-xl font-extrabold text-emerald-400">0.4 ms</span>
                <span className="text-[9px] text-emerald-300/80 block mt-1">99.2% Hit Ratio</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-white/50 block mb-1">Compound SQL Index</span>
                <span className="text-xl font-extrabold text-indigo-400">0 Table Scans</span>
                <span className="text-[9px] text-indigo-300/80 block mt-1">Direct Index Seek</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-white/50 block mb-1">Automated Late-Fee Cron</span>
                <span className="text-xl font-extrabold text-violet-400">12:00 AM Daily</span>
                <span className="text-[9px] text-violet-300/80 block mt-1">Serverless Execution</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
