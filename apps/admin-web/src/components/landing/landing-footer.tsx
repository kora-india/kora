"use client";

import Link from "next/link";
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Heart,
  Zap,
} from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="relative bg-[#05050a] border-t border-white/10 pt-20 pb-12 overflow-hidden">
      {/* Final Pre-Footer CTA Spotlight */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="relative rounded-3xl p-8 sm:p-14 bg-gradient-to-r from-violet-950/80 via-indigo-950/70 to-purple-950/80 border border-violet-500/30 overflow-hidden text-center shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-violet-600/30 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider mb-6 inline-block">
              Get Started Today
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
              Transform Your School Operations with Kora
            </h2>
            <p className="text-base sm:text-lg text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join hundreds of progressive schools eliminating hours of
              administrative paperwork every day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-indigo-950 font-extrabold text-sm hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Start Free 14-Day Trial</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/10 text-white font-semibold text-sm hover:bg-white/15 border border-white/20 backdrop-blur-md hover:scale-105 active:scale-95 transition-all"
              >
                Explore Live Demo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-white/10 text-xs sm:text-sm">
        {/* Brand Col */}
        <div className="col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-lg text-white tracking-tight">
              Kora
            </span>
          </Link>
          <p className="text-white/50 text-xs leading-relaxed max-w-xs">
            The next-generation unified Operating System for schools, academies,
            and educational trusts.
          </p>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Cloud Engines Operational</span>
          </div>
        </div>

        {/* Modules */}
        <div className="space-y-3">
          <h4 className="font-bold text-white uppercase tracking-wider text-xs">
            Core Modules
          </h4>
          <ul className="space-y-2 text-white/50">
            <li>
              <a
                href="#bento-overview"
                className="hover:text-white transition-colors"
              >
                Fee & Advance Allocation
              </a>
            </li>
            <li>
              <a
                href="#bento-overview"
                className="hover:text-white transition-colors"
              >
                Teacher Mobile PWA
              </a>
            </li>
            <li>
              <a
                href="#bento-overview"
                className="hover:text-white transition-colors"
              >
                Fleet & Route Logistics
              </a>
            </li>
            <li>
              <a
                href="#bento-overview"
                className="hover:text-white transition-colors"
              >
                Multi-Section Teachers
              </a>
            </li>
            <li>
              <a
                href="#bento-overview"
                className="hover:text-white transition-colors"
              >
                Analytics & Financial Hub
              </a>
            </li>
          </ul>
        </div>

        {/* Platform */}
        <div className="space-y-3">
          <h4 className="font-bold text-white uppercase tracking-wider text-xs">
            Platform
          </h4>
          <ul className="space-y-2 text-white/50">
            <li>
              <a href="#pricing" className="hover:text-white transition-colors">
                Pricing & Plans
              </a>
            </li>
            <li>
              <Link
                href="/login"
                className="hover:text-white transition-colors"
              >
                Admin Login
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="hover:text-white transition-colors"
              >
                Create School Account
              </Link>
            </li>
            <li>
              <a href="#faq" className="hover:text-white transition-colors">
                Frequently Asked Questions
              </a>
            </li>
          </ul>
        </div>

        {/* Trust & Security */}
        <div className="space-y-3">
          <h4 className="font-bold text-white uppercase tracking-wider text-xs">
            Security
          </h4>
          <ul className="space-y-2 text-white/50">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />{" "}
              Multi-Tenant Isolation
            </li>
            <li className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Redis Cached
              Latency
            </li>
            <li>Role-Based Access Control</li>
            <li>Daily Encrypted Backups</li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
        <p>© {new Date().getFullYear()} Kora Inc. All rights reserved.</p>
        <p className="flex items-center gap-1">
          Built for modern education institutions.
        </p>
      </div>
    </footer>
  );
}
