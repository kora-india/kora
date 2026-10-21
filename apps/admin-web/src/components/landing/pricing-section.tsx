"use client";

import { Check, Sparkles, ArrowRight, HelpCircle } from "lucide-react";
import Link from "next/link";
import {
  PAID_PLAN_IDS,
  PLANS,
  formatPlanPrice,
  type PaidPlanId,
} from "@/lib/plans";

export function PricingSection() {
  // Names, prices and features come from the plan catalogue (U1), so this
  // page shows what setup charges and what the app enforces.
  const buttonStyles: Record<PaidPlanId, string> = {
    BASIC: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300",
    PRO: "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25",
    ENTERPRISE: "bg-slate-900 hover:bg-black text-white",
  };
  const plans = PAID_PLAN_IDS.map((id) => {
    const plan = PLANS[id];
    return {
      name: plan.name,
      tagline: plan.tagline,
      price: formatPlanPrice(plan),
      period: "per month",
      popular: Boolean(plan.popular),
      badge: "Most Popular",
      benefits: plan.features,
      ctaText: "Start Free Trial",
      ctaHref: "/register",
      buttonStyle: buttonStyles[id],
    };
  });

  return (
    <section id="pricing" className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Simple Pricing. No Surprises.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Choose the plan that fits your school. Upgrade smoothly as your
            student enrollment grows.
          </p>
        </div>

        {/* 3 Pricing Cards */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`p-8 rounded-3xl transition-all flex flex-col justify-between relative ${
                p.popular
                  ? "bg-violet-50/50 border-2 border-violet-600 shadow-xl shadow-violet-500/10 scale-[1.02]"
                  : "bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-extrabold px-4 py-1 rounded-full shadow-sm">
                  {p.badge}
                </div>
              )}

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                  {p.tagline}
                </p>

                {/* Price Display */}
                <div className="mt-6 pb-6 border-b border-slate-200/80">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-900">
                      {p.price}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      /{p.period}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Billed monthly
                  </p>
                </div>

                {/* 5-6 Key Benefits */}
                <ul className="mt-6 space-y-3.5 text-sm text-slate-700">
                  {p.benefits.map((b, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span className="font-medium">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action CTA */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href={p.ctaHref}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${p.buttonStyle}`}
                >
                  <span>{p.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-center text-[11px] text-slate-400 mt-2.5">
                  14-day free trial • No credit card needed
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Guarantee Box */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center max-w-2xl mx-auto flex items-center justify-center gap-3 text-xs sm:text-sm text-slate-600">
          <HelpCircle className="w-5 h-5 text-violet-600 flex-shrink-0" />
          <span>
            Need an on-premise installation or custom payment cycle?{" "}
            <a
              href="#final-cta"
              className="font-bold text-violet-700 hover:underline"
            >
              Speak with our education specialists.
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
