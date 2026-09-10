"use client";

import { ShieldCheck, Lock, HardDriveDownload } from "lucide-react";

export function SecurityTrust() {
  const trustPoints = [
    {
      title: "Private School Data",
      description:
        "Your student, financial, and staff records are completely private to your school. We never sell, share, or advertise against your information.",
      icon: Lock,
    },
    {
      title: "Secure Access for Every Team Member",
      description:
        "Give staff only the access they need to do their job. Teachers mark attendance without seeing fee ledgers, and accountants don't edit grades.",
      icon: ShieldCheck,
    },
    {
      title: "Automatic Daily Backups",
      description:
        "Your school's data is backed up safely every single day. Even if an office laptop crashes or gets lost, your school records are always safe.",
      icon: HardDriveDownload,
    },
  ];

  return (
    <section className="py-20 bg-slate-50/70 border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="px-3.5 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 inline-block border border-violet-200">
            Data Safety & Trust
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Your School&apos;s Information Stays Protected
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            We take your school&apos;s records seriously so you can focus on
            educating students and running your school with complete peace of
            mind.
          </p>
        </div>

        {/* 3 Trust Pillars */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
          {trustPoints.map((pt, idx) => {
            const Icon = pt.icon;
            return (
              <div
                key={idx}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mb-5 border border-violet-100">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {pt.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {pt.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
