"use client";

import {
  FileCheck2,
  CheckCircle2,
  Zap,
  MessageCircle,
  Smile,
  Eye,
  Settings2,
  HeartHandshake,
} from "lucide-react";

export function BenefitsSection() {
  const benefits = [
    {
      title: "80% Less Paperwork",
      description:
        "Replace stacks of physical files, fee registers, and printed forms with one clean digital hub.",
      icon: FileCheck2,
    },
    {
      title: "Fewer Costly Mistakes",
      description:
        "Automated calculations prevent fee disputes, missing student records, and misplaced receipts.",
      icon: CheckCircle2,
    },
    {
      title: "Faster Fee Collections",
      description:
        "Friendly digital reminders and instant receipts ensure parents pay their dues on time.",
      icon: Zap,
    },
    {
      title: "Better Communication",
      description:
        "Keep parents informed with instant notifications about attendance, exams, events, and circulars.",
      icon: MessageCircle,
    },
    {
      title: "Happier Teachers",
      description:
        "Free your teachers from 40 minutes of daily clerical busywork so they can focus on teaching.",
      icon: Smile,
    },
    {
      title: "Instant Visibility",
      description:
        "Principals and directors can check student counts, fee totals, and bus routes anytime from their phone.",
      icon: Eye,
    },
    {
      title: "Simpler Administration",
      description:
        "Standardize your school's daily workflows so tasks are handled smoothly even when staff are away.",
      icon: Settings2,
    },
    {
      title: "Delighted Parents",
      description:
        "Give parents a modern, transparent school experience that builds lasting trust in your institution.",
      icon: HeartHandshake,
    },
  ];

  return (
    <section className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4 inline-block border border-emerald-200">
            Real Impact
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            More Time for What Actually Matters
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            When everyday school administration runs itself smoothly, your
            entire school community thrives.
          </p>
        </div>

        {/* 8 Benefit Cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 hover:bg-violet-50/40 hover:border-violet-200 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-violet-600 mb-5 shadow-sm group-hover:scale-105 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {b.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {b.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
