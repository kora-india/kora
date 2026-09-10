"use client";

import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export function BeforeAfterSection() {
  const comparisons = [
    {
      before: "Stacks of physical paper registers and handwritten notes",
      after: "Everything organized in one clean digital system",
    },
    {
      before: "Hours spent tracking who paid and who is still pending",
      after: "Clear, real-time fee tracking with 1-click receipts",
    },
    {
      before: "Front desk overwhelmed with repeated parent phone calls",
      after: "Instant mobile circulars and automatic SMS reminders",
    },
    {
      before: "Student files and documents scattered across filing cabinets",
      after: "Complete student profiles accessible from any device",
    },
    {
      before: "Teachers wasting 20 minutes every morning on roll call",
      after: "30-second attendance marking from teachers' smartphones",
    },
    {
      before: "Days of stressful manual work to prepare board reports",
      after: "Instant visual summaries and 1-click Excel exports",
    },
  ];

  return (
    <section className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="px-3.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-4 inline-block border border-slate-200">
            Transformation
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            From Daily Chaos to Complete Control
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            See the difference modern, human-centered software makes in your
            school&apos;s everyday administration.
          </p>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Before Kora Card */}
          <div className="bg-rose-50/40 p-8 rounded-3xl border border-rose-200/80 shadow-sm">
            <div className="flex items-center gap-3 pb-6 border-b border-rose-200/60">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  The Old Way
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Before Kora
                </h3>
              </div>
            </div>

            <ul className="mt-6 space-y-4">
              {comparisons.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm text-slate-700"
                >
                  <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span>{item.before}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* With Kora Card */}
          <div className="bg-violet-50/40 p-8 rounded-3xl border border-violet-200 shadow-md relative overflow-hidden">
            {/* Top Accent Ribbon */}
            <div className="absolute top-0 right-0 bg-violet-600 text-white text-[10px] font-bold px-4 py-1 rounded-bl-xl uppercase tracking-wider">
              Recommended
            </div>

            <div className="flex items-center gap-3 pb-6 border-b border-violet-200/60">
              <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                  The Modern Way
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  With Kora
                </h3>
              </div>
            </div>

            <ul className="mt-6 space-y-4">
              {comparisons.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm font-semibold text-slate-900"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span>{item.after}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-6 border-t border-violet-200/60 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Ready to make the switch?
              </span>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-800"
              >
                <span>Try Kora for Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
