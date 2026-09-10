"use client";

import {
  FileSpreadsheet,
  Clock,
  PhoneCall,
  Bus,
  FolderArchive,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

export function ProblemSection() {
  const problems = [
    {
      icon: FileSpreadsheet,
      title: "Fee Records Everywhere",
      description:
        "Spreadsheets, notebooks, receipts and WhatsApp messages make it difficult to know what is actually paid.",
      pain: "Hours lost cross-referencing bank slips",
    },
    {
      icon: Clock,
      title: "Attendance Takes Too Long",
      description:
        "Teachers spend valuable classroom time marking paper registers instead of engaging students.",
      pain: "20 minutes wasted every morning",
    },
    {
      icon: PhoneCall,
      title: "Parents Keep Calling the Office",
      description:
        "Staff spend hours answering the same questions about fees, attendance, transport and school notices.",
      pain: "Front desk overwhelmed with repeated calls",
    },
    {
      icon: Bus,
      title: "Transport Is Hard to Track",
      description:
        "Managing routes, students, drivers and transport charges manually creates unnecessary stress.",
      pain: "Driver phone calls & route confusion",
    },
    {
      icon: FolderArchive,
      title: "Too Much Paperwork",
      description:
        "Important information gets scattered across physical registers, filing cabinets and different computers.",
      pain: "Lost documents & duplicated work",
    },
    {
      icon: HelpCircle,
      title: "You Don't Have a Clear Picture",
      description:
        "School management should be able to understand what is happening without asking five different people.",
      pain: "No instant overview for principals & directors",
    },
  ];

  return (
    <section
      id="why-kora"
      className="py-24 bg-slate-50/70 border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-100/80 text-rose-700 text-xs font-bold uppercase tracking-wider mb-4 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>The Reality of School Operations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Still Managing Your School the Hard Way?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Running a school involves hundreds of moving parts every day. When
            records live in multiple registers and spreadsheets, simple tasks
            turn into daily headaches.
          </p>
        </div>

        {/* 6 Problem Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((prob, i) => {
            const Icon = prob.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform border border-rose-100">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {prob.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {prob.description}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-rose-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{prob.pain}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
