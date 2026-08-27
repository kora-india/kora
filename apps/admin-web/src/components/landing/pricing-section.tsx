"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      description: "Perfect for single schools starting their digital transformation.",
      monthlyPrice: "₹2,499",
      annualPrice: "₹1,999",
      period: "/month",
      featured: false,
      features: [
        "Up to 300 active students",
        "Up to 15 teachers & staff",
        "Teacher Mobile PWA attendance",
        "Standard Fee collection & receipts",
        "Notices & Announcements board",
        "Email support",
      ],
      ctaText: "Start 14-Day Free Trial",
    },
    {
      name: "Launch & Growth",
      description: "The complete operating system for established institutions.",
      monthlyPrice: "₹4,999",
      annualPrice: "₹3,999",
      period: "/month",
      featured: true,
      badge: "MOST POPULAR",
      features: [
        "Up to 1,500 active students",
        "Unlimited teachers & accountants",
        "Advance Ledger auto-reconciliation",
        "Distance-based Bus & Fleet Billing",
        "Multi-Section & Class Teacher Mapping",
        "Automated Late-Fee Cron Penalty",
        "Real-time Financial Analytics Hub",
        "Priority WhatsApp & Phone Support",
      ],
      ctaText: "Launch SchoolOS Pro",
    },
    {
      name: "Enterprise",
      description: "For multi-branch school chains & educational trusts.",
      monthlyPrice: "Custom",
      annualPrice: "Custom",
      period: "",
      featured: false,
      features: [
        "Unlimited students & campuses",
        "Multi-School central headquarters portal",
        "White-label branding & custom domain",
        "Custom ERP integration & API access",
        "Dedicated account manager",
        "99.99% SLA uptime guarantee",
      ],
      ctaText: "Contact Enterprise Sales",
    },
  ];

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            <span>Predictable Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Transparent Pricing. No Per-Student Hidden Fees.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/60">
            One flat subscription per school. Scale your student count without worrying about ballooning software costs.
          </p>

          {/* Billing Switcher */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                !isAnnual
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                isAnnual
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-[10px] font-extrabold text-black">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`rounded-3xl p-8 flex flex-col justify-between relative transition-all duration-300 ${
                plan.featured
                  ? "bg-gradient-to-b from-violet-900/60 via-indigo-950/40 to-black/60 border-2 border-violet-500/50 shadow-[0_0_50px_rgba(139,92,246,0.3)] scale-105 z-10"
                  : "bg-white/[0.03] border border-white/10 hover:border-white/20 backdrop-blur-xl"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-[11px] font-extrabold text-white shadow-lg border border-white/20 tracking-wider">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-xs text-white/50 mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-1 mb-8 pb-6 border-b border-white/10">
                  <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                    {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-xs text-white/50 font-medium">{plan.period}</span>
                </div>

                <div className="space-y-3.5 mb-8">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-white/80">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${plan.featured ? "text-violet-400" : "text-emerald-400"}`} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Link
                  href="/register"
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    plan.featured
                      ? "bg-white text-indigo-950 hover:bg-white/90 shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-white/10 text-white hover:bg-white/15 border border-white/10"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
