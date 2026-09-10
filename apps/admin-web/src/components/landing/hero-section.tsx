"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Play,
  IndianRupee,
  Users,
  Bus,
  Bell,
  Calendar,
  Check,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-violet-50/50 via-white to-white">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-purple-100/50 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Announcement Pill */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100/80 border border-violet-200/80 text-violet-800 text-xs sm:text-sm font-semibold shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-violet-600 animate-pulse" />
            <span>Kora 2.0 is Live</span>
            <span className="text-violet-400">•</span>
            <span className="text-violet-700">
              Built specifically for school leaders
            </span>
          </div>
        </motion.div>

        {/* Hero Headline & Subheadline */}
        <div className="mt-8 text-center max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.12]"
          >
            Running a School Shouldn&apos;t Feel This Complicated.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            Kora brings fees, attendance, transport, staff, communication and
            everyday school operations into one simple platform.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-base shadow-lg shadow-violet-500/25 hover:shadow-violet-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span>Start Your Free Trial</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center justify-center gap-2.5"
            >
              <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">
                <Play className="w-3 h-3 fill-violet-700 ml-0.5" />
              </div>
              <span>See How Kora Works</span>
            </a>
          </motion.div>

          {/* Reassurance Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-medium text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              Easy 10-minute setup
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              Built for schools of all sizes
            </span>
          </motion.div>
        </div>

        {/* HERO VISUAL: Realistic Browser Window & School Operations Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-14 relative max-w-5xl mx-auto"
        >
          {/* Floating Feature Badges around the dashboard */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="hidden lg:flex absolute -top-6 -left-8 z-20 items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Fee Receipt #2481
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">
                Sent to parent on WhatsApp
              </p>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="hidden lg:flex absolute -bottom-6 -right-8 z-20 items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Class 8-A Attendance
              </p>
              <p className="text-[11px] text-violet-600 font-medium">
                Marked in 35 seconds from phone
              </p>
            </div>
          </motion.div>

          {/* Browser Window Frame */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* Window Top Controls */}
            <div className="h-11 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-1 rounded-lg border border-slate-200 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>kora.app/school/overview</span>
              </div>
              <div className="w-10" />
            </div>

            {/* Dashboard Content */}
            <div className="p-5 sm:p-8 bg-slate-50/50">
              {/* Top Greeting & Date */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Good Morning, Principal Sharma 👋
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Here is what is happening at Bright Valley School today.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-violet-600" />
                  <span>Academic Term 2026–27</span>
                </div>
              </div>

              {/* 4 Key Everyday Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {/* 1. Fees Collected */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Fees Collected Today
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">
                    ₹1,42,500
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>84% of monthly target met</span>
                  </div>
                </div>

                {/* 2. Student Attendance */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Students Present
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">
                    95.4%
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    1,240 present • 60 absent
                  </p>
                </div>

                {/* 3. Bus Routes */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      School Bus Trips
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Bus className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">
                    8 / 8
                  </p>
                  <p className="mt-2 text-xs text-emerald-600 font-medium">
                    All morning routes on schedule
                  </p>
                </div>

                {/* 4. Pending Reminders */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Pending Reminders
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">
                    14 Families
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Auto-reminder scheduled at 4 PM
                  </p>
                </div>
              </div>

              {/* Realistic Quick Action & Recent Activity Split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                {/* Recent Fee Receipts */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900">
                      Recent Fee Receipts
                    </h3>
                    <span className="text-xs font-semibold text-violet-600 hover:text-violet-700 cursor-pointer">
                      View All Receipts →
                    </span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      {
                        name: "Aarav Sharma",
                        class: "Grade 6-A",
                        amount: "₹18,500",
                        status: "Paid via UPI",
                        time: "10 mins ago",
                      },
                      {
                        name: "Ananya Deshmukh",
                        class: "Grade 10-B",
                        amount: "₹24,000",
                        status: "Paid in Cash",
                        time: "25 mins ago",
                      },
                      {
                        name: "Rohan Varma",
                        class: "Grade 3-C",
                        amount: "₹15,000",
                        status: "Cheque Cleared",
                        time: "1 hour ago",
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-violet-50/40 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-[10px]">
                            {item.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {item.class}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-900">
                            {item.amount}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-medium">
                            {item.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Important School Notices */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">
                        School Notices
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">
                        Live
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-100 text-xs">
                        <p className="font-bold text-violet-950">
                          Annual Sports Meet Circular
                        </p>
                        <p className="text-slate-600 text-[11px] mt-1">
                          Dispatched to 1,300 parents with consent form.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <p className="font-bold text-slate-900">
                          Term 2 Exam Timetable
                        </p>
                        <p className="text-slate-500 text-[11px] mt-1">
                          Published for Grades 1 to 12.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button className="mt-4 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors">
                    Send New Notice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
