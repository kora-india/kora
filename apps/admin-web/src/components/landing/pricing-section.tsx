"use client";

import { Check, Sparkles, ArrowRight, HelpCircle } from "lucide-react";
import Link from "next/link";

export function PricingSection() {
  const plans = [
    {
      name: "Starter",
      tagline: "For schools getting started with digital management.",
      price: "₹1,999",
      period: "per month",
      popular: false,
      benefits: [
        "Up to 300 enrolled students",
        "Complete fee management & receipts",
        "Fast mobile attendance for teachers",
        "Broadcast school notices & circulars",
        "Standard Excel & PDF reports",
        "Help desk & email support",
      ],
      ctaText: "Start Free Trial",
      ctaHref: "/register?plan=starter",
      buttonStyle:
        "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300",
    },
    {
      name: "Growth",
      tagline:
        "For established schools that want complete operational control.",
      price: "₹3,999",
      period: "per month",
      popular: true,
      badge: "Most Popular",
      benefits: [
        "Up to 1,500 enrolled students",
        "Everything in Starter included",
        "School bus & transport management",
        "Multiple branches, sections & teachers",
        "Automated WhatsApp fee receipts",
        "Priority phone & WhatsApp support",
      ],
      ctaText: "Start Free Trial",
      ctaHref: "/register?plan=growth",
      buttonStyle:
        "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25",
    },
    {
      name: "Enterprise",
      tagline: "For large institutions, multi-campus groups & trusts.",
      price: "Custom",
      period: "annual contract",
      popular: false,
      benefits: [
        "Unlimited students & campuses",
        "Central management dashboard",
        "Custom school logo & branding",
        "Full data migration from old software",
        "Dedicated school relationship manager",
        "Custom ERP & accounting integrations",
      ],
      ctaText: "Talk to Us",
      ctaHref: "#final-cta",
      buttonStyle: "bg-slate-900 hover:bg-black text-white",
    },
  ];

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
                    Billed annually or monthly
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
