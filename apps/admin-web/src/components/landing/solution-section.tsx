"use client";

import { useState } from "react";
import {
  IndianRupee,
  Users,
  GraduationCap,
  Bus,
  Bell,
  BarChart3,
  Sparkles,
  School,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

export function SolutionSection() {
  const [selectedModule, setSelectedModule] = useState(0);

  const modules = [
    {
      id: "fees",
      title: "Fee Management",
      icon: IndianRupee,
      color: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200",
      benefit:
        "Track paid, pending and advance fees with instant automated WhatsApp receipts.",
    },
    {
      id: "attendance",
      title: "Daily Attendance",
      icon: Users,
      color: "from-violet-500 to-indigo-600",
      bgLight: "bg-violet-50 text-violet-700 border-violet-200",
      benefit:
        "Teachers mark classroom attendance in 30 seconds straight from their smartphone.",
    },
    {
      id: "students",
      title: "Student Records",
      icon: GraduationCap,
      color: "from-blue-500 to-cyan-600",
      bgLight: "bg-blue-50 text-blue-700 border-blue-200",
      benefit:
        "Complete student profiles, emergency contacts, documents, and parent info in 1 place.",
    },
    {
      id: "teachers",
      title: "Staff & Teachers",
      icon: School,
      color: "from-purple-500 to-pink-600",
      bgLight: "bg-purple-50 text-purple-700 border-purple-200",
      benefit:
        "Assign subjects, manage timetables, and give teachers the exact tools they need.",
    },
    {
      id: "transport",
      title: "School Transport",
      icon: Bus,
      color: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50 text-amber-700 border-amber-200",
      benefit:
        "Manage bus routes, student stops, driver phone numbers, and transport fees cleanly.",
    },
    {
      id: "communication",
      title: "Notices & Updates",
      icon: Bell,
      color: "from-rose-500 to-red-600",
      bgLight: "bg-rose-50 text-rose-700 border-rose-200",
      benefit:
        "Send circulars, exam dates, fee reminders, and holiday notices in one broadcast.",
    },
    {
      id: "reports",
      title: "Executive Reports",
      icon: BarChart3,
      color: "from-indigo-500 to-blue-700",
      bgLight: "bg-indigo-50 text-indigo-700 border-indigo-200",
      benefit:
        "Understand collections, enrollment trends, and attendance health without digging.",
    },
  ];

  return (
    <section className="py-24 bg-white border-b border-slate-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Unified Solution</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            One Simple System for Your Entire School
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Kora brings everyday school operations together so your team spends
            less time managing paperwork and more time running the school.
          </p>
        </div>

        {/* Central Hub Flow Diagram */}
        <div className="mt-16 bg-slate-50/70 p-6 sm:p-12 rounded-3xl border border-slate-200/90 relative">
          {/* Active Highlight Banner */}
          <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Active Module Benefit
                </p>
                <h4 className="text-base font-extrabold text-slate-900">
                  {modules[selectedModule].title}
                </h4>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-600 sm:max-w-md">
              {modules[selectedModule].benefit}
            </p>
          </div>

          {/* Connected Grid of Modules */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              const isSelected = selectedModule === i;
              return (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(i)}
                  className={`p-5 rounded-2xl text-left transition-all flex flex-col justify-between h-36 border ${
                    isSelected
                      ? "bg-white border-violet-500 shadow-md ring-2 ring-violet-500/20 scale-[1.02]"
                      : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? "bg-violet-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-violet-600" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`font-bold text-sm ${
                        isSelected ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {mod.title}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      Click to explore
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Central Hub Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white flex flex-col justify-between h-36 shadow-lg shadow-violet-500/20">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-extrabold text-white">
                K
              </div>
              <div>
                <p className="font-extrabold text-sm text-white">
                  Kora School Hub
                </p>
                <p className="text-[11px] text-violet-200 mt-0.5">
                  Synchronized in real-time
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
