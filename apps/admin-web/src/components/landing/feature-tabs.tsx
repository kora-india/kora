"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Smartphone,
  Bus,
  ShieldCheck,
  CheckCircle,
  Zap,
  ArrowRight,
  Receipt,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";

export function FeatureTabs() {
  const [activeTab, setActiveTab] = useState("finance");

  const tabs = [
    {
      id: "finance",
      label: "Finance & Fee Allocation",
      icon: CreditCard,
      badge: "Zero Manual Errors",
      title: "Smart Fee Generation & Realtime Advance Reconciliation",
      description:
        "Kora automatically generates monthly dues, deducts accumulated advance balances with negative ledgers, handles component-level waivers, and generates instant receipt numbers with no accountant bottlenecks.",
      features: [
        "Automated batch fee generation in <300ms",
        "Advance payment ledger with auto-settlement against new dues",
        "Configurable automated late fees (Daily, Weekly, Monthly)",
        "Instant multi-format receipt printing (A4, A5, Thermal POS)",
      ],
      preview: {
        type: "finance",
      },
    },
    {
      id: "teacher-pwa",
      label: "Teacher Mobile PWA",
      icon: Smartphone,
      badge: "Instant 20-Sec Roll Call",
      title: "Fast Mobile Attendance with Instant Parent Alerts",
      description:
        "Teachers do not need to install heavy native apps. The Kora Progressive Web App opens instantly in any mobile browser, lets teachers mark whole classes in 20 seconds, and syncs directly with the central admin portal.",
      features: [
        "Offline-capable PWA with zero install friction",
        "Switch between all assigned classes and sections in 1 tap",
        "Real-time attendance percentage analytics and daily heatmaps",
        "Automated WhatsApp & SMS absence triggers to parents",
      ],
      preview: {
        type: "teacher-pwa",
      },
    },
    {
      id: "transport",
      label: "Transport & Fleet",
      icon: Bus,
      badge: "Distance-Based",
      title: "Intelligent Route Stops, Capacity & Bus Billing",
      description:
        "Manage school buses, vans, and auto-rickshaws. Calculate monthly bus fees based on stop distance in kilometers, configure pickup-only or drop-only multipliers, and view live vehicle seat occupancy.",
      features: [
        "Stops sequenced by route order with exact distance in KM",
        "Automatic monthly transport fee item added to student fee charge",
        "Live bus occupancy gauge and capacity overload warning",
        "Printable Driver Passenger Manifest for daily route pickup",
      ],
      preview: {
        type: "transport",
      },
    },
    {
      id: "security",
      label: "Security & Multi-Tenant",
      icon: ShieldCheck,
      badge: "Enterprise Grade",
      title: "Role-Based Access Control & Multi-School Isolation",
      description:
        "Every school's data is strictly partitioned by tenant IDs. Super Admins manage multiple school subscriptions, while School Admins, Teachers, and Accountants only access what they are explicitly authorized to view.",
      features: [
        "100% tenant data isolation at the database query layer",
        "Fine-grained roles: Super Admin, School Admin, Teacher, Accountant",
        "Session authentication backed by NextAuth v5 & JWT tokens",
        "End-to-end audit logging for critical financial transactions",
      ],
      preview: {
        type: "security",
      },
    },
  ];

  const current = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <section
      id="features"
      className="py-24 relative bg-black/40 border-t border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered to Solve Real School Pain Points
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/60">
            Explore how Kora modernizes daily administrative, financial, and
            educational operations.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? "bg-violet-600 text-white border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.4)] scale-105"
                    : "bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-white" : "text-violet-400"}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              {/* Left Column: Details */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>{current.badge}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {current.title}
                </h3>

                <p className="text-white/65 text-sm sm:text-base leading-relaxed">
                  {current.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {current.features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-white/80"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Visual Preview Panel */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
                {current.preview.type === "finance" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="font-bold text-white">
                        Fee Settlement Summary
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        AUTO-RECONCILED
                      </span>
                    </div>
                    <div className="space-y-2 text-white/80">
                      <div className="flex justify-between">
                        <span className="text-white/50">
                          Tuition & Lab Net Charge
                        </span>
                        <span className="font-semibold text-white">₹2,200</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">
                          Advance Ledger Credit
                        </span>
                        <span className="font-bold text-emerald-400">
                          -₹800
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">
                          Bus Transport (Zone 2)
                        </span>
                        <span className="font-semibold text-white">₹750</span>
                      </div>
                      <div className="pt-2 border-t border-white/10 flex justify-between items-baseline font-extrabold text-sm text-amber-400">
                        <span className="text-white">
                          Total Remaining Payable:
                        </span>
                        <span>₹2,150</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-violet-400" />
                      <span>Receipt: RCP-2026-97792 generated via Cashier</span>
                    </div>
                  </div>
                )}

                {current.preview.type === "teacher-pwa" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="font-bold text-white">
                        Teacher Live Roster
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        98% PRESENT
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                        <span className="font-medium text-white">
                          Aarav Sharma (#101)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          PRESENT
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                        <span className="font-medium text-white">
                          Diya Patel (#102)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          PRESENT
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                        <span className="font-medium text-white">
                          Kabir Verma (#103)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold text-[10px]">
                          ABSENT
                        </span>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Auto WhatsApp sent to Absent parent: Kabir Verma
                      </span>
                    </div>
                  </div>
                )}

                {current.preview.type === "transport" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="font-bold text-white">
                        Route 4 - Sector 62
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                        35/42 SEATS
                      </span>
                    </div>
                    <div className="space-y-2 text-white/80">
                      <div className="flex justify-between p-2 rounded-lg bg-white/5">
                        <span>Stop 1: Cyber City (3.2 km)</span>
                        <span className="font-bold text-amber-300">
                          ₹400 / mo
                        </span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-white/5">
                        <span>Stop 2: Golf Course (6.1 km)</span>
                        <span className="font-bold text-amber-300">
                          ₹650 / mo
                        </span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-white/5">
                        <span>Stop 3: Sector 62 (8.5 km)</span>
                        <span className="font-bold text-amber-300">
                          ₹850 / mo
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {current.preview.type === "security" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="font-bold text-white">
                        Access Scoping & Multi-Tenant
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        ISOLATED
                      </span>
                    </div>
                    <div className="space-y-1.5 text-white/80">
                      <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                        <span>Super Admin</span>
                        <span className="text-[10px] text-violet-400 font-bold">
                          Platform Wide
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                        <span>School Admin</span>
                        <span className="text-[10px] text-indigo-400 font-bold">
                          School Scoped
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                        <span>Teacher Portal</span>
                        <span className="text-[10px] text-emerald-400 font-bold">
                          Assigned Classes
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                        <span>Accountant</span>
                        <span className="text-[10px] text-amber-400 font-bold">
                          Fee Cashier
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
