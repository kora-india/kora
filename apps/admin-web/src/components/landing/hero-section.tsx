"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Zap, CheckCircle2, Play, Users, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background Glows & Grids */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[450px] bg-gradient-to-tr from-violet-600/25 via-indigo-600/20 to-purple-600/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-violet-600/10 to-transparent pointer-events-none -z-10" />
      
      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.12] -z-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Release Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 text-xs sm:text-sm font-semibold mb-8 shadow-[0_0_25px_rgba(139,92,246,0.25)] hover:border-violet-500/50 transition-colors"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>SchoolOS 2.0 is Live • Multi-Branch & Realtime Cloud Engine</span>
          <ArrowRight className="w-3.5 h-3.5 text-violet-400/80" />
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.12]"
        >
          The Next-Generation{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-purple-400 drop-shadow-[0_0_35px_rgba(139,92,246,0.3)]">
            Operating System
          </span>{" "}
          for High-Performing Schools
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-white/65 max-w-3xl mx-auto leading-relaxed font-normal"
        >
          Automate complex fee reconciliations, record 20-second attendance with the Teacher PWA, manage bus fleets with distance-based billing, and eliminate operational chaos with sub-5ms cloud speed.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md sm:max-w-none mx-auto"
        >
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white font-bold text-base shadow-[0_0_35px_rgba(139,92,246,0.4)] hover:shadow-[0_0_50px_rgba(139,92,246,0.6)] hover:scale-105 active:scale-95 transition-all duration-200 border border-white/25 flex items-center justify-center gap-2 group"
          >
            <span>Start 14-Day Free Trial</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-semibold text-base border border-white/15 backdrop-blur-md hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 text-violet-400 fill-violet-400" />
            <span>Explore Live Demo</span>
          </Link>
        </motion.div>

        {/* Micro-Features Checklist */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-white/50"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Full data isolation per school</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Instant setup in &lt; 2 minutes</span>
          </div>
        </motion.div>

        {/* Live Trust Metrics Strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl max-w-5xl mx-auto shadow-2xl"
        >
          <div className="p-3 text-left sm:text-center border-r border-white/5 last:border-0">
            <div className="flex items-center sm:justify-center gap-2 text-violet-400 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-2xl sm:text-3xl font-extrabold text-white">150k+</span>
            </div>
            <p className="text-xs text-white/50 font-medium">Students Enrolled</p>
          </div>

          <div className="p-3 text-left sm:text-center border-r border-white/5 last:border-0">
            <div className="flex items-center sm:justify-center gap-2 text-emerald-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-2xl sm:text-3xl font-extrabold text-white">99.8%</span>
            </div>
            <p className="text-xs text-white/50 font-medium">Fee Collection Rate</p>
          </div>

          <div className="p-3 text-left sm:text-center border-r border-white/5 last:border-0">
            <div className="flex items-center sm:justify-center gap-2 text-amber-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-2xl sm:text-3xl font-extrabold text-white">20 Sec</span>
            </div>
            <p className="text-xs text-white/50 font-medium">Avg Roll Call Time</p>
          </div>

          <div className="p-3 text-left sm:text-center">
            <div className="flex items-center sm:justify-center gap-2 text-indigo-400 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-2xl sm:text-3xl font-extrabold text-white">0.4 ms</span>
            </div>
            <p className="text-xs text-white/50 font-medium">Redis Cache Latency</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
