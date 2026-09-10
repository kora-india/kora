"use client";

import {
  School,
  UserPlus,
  PlayCircle,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Create Your School Account",
      description:
        "Enter your school name, branches, and academic calendar in under two minutes. No complex software installation required.",
      icon: School,
      tag: "Takes 2 Minutes",
      points: [
        "Web-based setup",
        "Set academic terms",
        "Customize school branding",
      ],
    },
    {
      step: "02",
      title: "Add Your Team & Students",
      description:
        "Bring your existing student rosters and staff information directly from Excel or spreadsheets with our 1-click import guide.",
      icon: UserPlus,
      tag: "1-Click Excel Import",
      points: [
        "Import student lists",
        "Invite teachers & accountants",
        "Pre-set class sections",
      ],
    },
    {
      step: "03",
      title: "Start Running Your School",
      description:
        "Mark attendance, collect fees, generate receipts, and send parent circulars immediately from your phone or desktop.",
      icon: PlayCircle,
      tag: "Day One Results",
      points: [
        "Instant digital receipts",
        "Mobile attendance live",
        "Real-time visibility",
      ],
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 bg-slate-50/60 border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simple Onboarding</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Get Your School Up and Running in 3 Simple Steps
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            You don&apos;t need an IT department or software engineers. If you
            can use a smartphone, you can run Kora.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-300 transition-all flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center font-extrabold text-lg border border-violet-100 group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-4xl font-extrabold text-slate-200 group-hover:text-violet-200 transition-colors">
                      {s.step}
                    </span>
                  </div>

                  <span className="inline-block px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 text-[11px] font-bold mb-3">
                    {s.tag}
                  </span>

                  <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {s.description}
                  </p>

                  <ul className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-700">
                    {s.points.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Fast Track CTA */}
        <div className="mt-14 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md shadow-violet-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span>Set Up Your School in 10 Minutes</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
