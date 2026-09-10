"use client";

import {
  GraduationCap,
  Building,
  Award,
  Landmark,
  BookOpen,
  School,
  Sparkles,
  Compass,
} from "lucide-react";

export function TrustBar() {
  const demoSchools = [
    { name: "Delhi Public School", tag: "Reference Demo", icon: Landmark },
    {
      name: "Bright Future Academy",
      tag: "Reference Demo",
      icon: GraduationCap,
    },
    {
      name: "Sunrise International School",
      tag: "Reference Demo",
      icon: Award,
    },
    { name: "St. Xavier's High School", tag: "Reference Demo", icon: Building },
    { name: "Oakridge Global Academy", tag: "Reference Demo", icon: BookOpen },
    {
      name: "Greenwood High International",
      tag: "Reference Demo",
      icon: School,
    },
    {
      name: "Heritage Valley Model School",
      tag: "Reference Demo",
      icon: Compass,
    },
    { name: "National Public Academy", tag: "Reference Demo", icon: Sparkles },
  ];

  // Duplicate for seamless infinite loop
  const marqueeItems = [...demoSchools, ...demoSchools];

  return (
    <section className="py-12 border-y border-slate-100 bg-white overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-6">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400">
          Trusted by Schools That Want Less Paperwork and More Control
        </p>
      </div>

      {/* Marquee Track Container with Gradient Edge Fades */}
      <div className="relative w-full overflow-hidden">
        {/* Left Gradient Fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-10" />

        {/* Right Gradient Fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-10" />

        {/* Scrolling Track */}
        <div className="animate-marquee flex gap-6 sm:gap-8 items-center py-2">
          {marqueeItems.map((school, i) => {
            const Icon = school.icon;
            return (
              <div
                key={i}
                className="group flex-shrink-0 flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-slate-50/90 border border-slate-200/70 hover:border-violet-300 hover:bg-violet-50/40 hover:shadow-sm transition-all duration-200 cursor-default"
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center text-violet-600 shadow-sm group-hover:scale-105 group-hover:bg-violet-600 group-hover:text-white transition-all">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left whitespace-nowrap">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-700 group-hover:text-slate-900 transition-colors">
                    {school.name}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-slate-400 group-hover:text-violet-600 transition-colors">
                    {school.tag}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mt-5">
        <p className="text-[11px] text-slate-400">
          * Representative demo installations. Kora is custom-configured for
          your school syllabus, fee terms, and bus routes.
        </p>
      </div>
    </section>
  );
}
