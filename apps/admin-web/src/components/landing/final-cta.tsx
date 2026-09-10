"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Check,
  Sparkles,
  MessageCircle,
  X,
} from "lucide-react";
import { Modal } from "antd";

export function FinalCTA() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section
      id="final-cta"
      className="py-24 bg-gradient-to-b from-white via-violet-50/50 to-violet-100/30 border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl p-8 sm:p-16 bg-white border border-violet-200/80 shadow-2xl shadow-violet-500/10 overflow-hidden text-center">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 right-1/4 w-[350px] h-[350px] bg-violet-100/60 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-purple-100/60 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="max-w-3xl mx-auto">
            <span className="px-3.5 py-1.5 rounded-full bg-violet-100 text-violet-800 text-xs font-bold uppercase tracking-wider mb-6 inline-block border border-violet-200">
              Get Started Today
            </span>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Give Your School a Simpler Way to Work.
            </h2>

            <p className="mt-6 text-base sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Replace paperwork, scattered information and repetitive tasks with
              one simple system built for modern schools.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-base shadow-lg shadow-violet-500/25 hover:shadow-violet-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
              >
                <span>Start Your Free Trial</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <button
                onClick={() => setDemoModalOpen(true)}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base border border-slate-300 shadow-sm hover:border-slate-400 transition-all flex items-center justify-center gap-2.5"
              >
                <Phone className="w-4 h-4 text-violet-600" />
                <span>Talk to Our Team</span>
              </button>
            </div>

            {/* Micro Guarantees */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                Full onboarding support included
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Talk to Team Modal (Ant Design) */}
      <Modal
        open={demoModalOpen}
        onCancel={() => {
          setDemoModalOpen(false);
          setSubmitted(false);
        }}
        footer={null}
        centered
        width={480}
        destroyOnClose
      >
        <div className="p-4 sm:p-6 text-left">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 font-bold">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Thank You!</h3>
              <p className="text-sm text-slate-600 mt-2">
                Our education specialist will contact you within 2 business
                hours to schedule your personalized demo.
              </p>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="mt-6 px-6 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs"
              >
                Done
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Talk to Our Education Team
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tell us a little about your school and we&apos;ll set up a
                guided walkthrough.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
                className="mt-5 space-y-3.5 text-xs font-semibold text-slate-700"
              >
                <div>
                  <label className="block mb-1">Your Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Principal Sharma"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-normal"
                  />
                </div>
                <div>
                  <label className="block mb-1">School Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Bright Future Academy"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-normal"
                  />
                </div>
                <div>
                  <label className="block mb-1">Phone / WhatsApp Number</label>
                  <input
                    required
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-normal"
                  />
                </div>
                <div>
                  <label className="block mb-1">
                    Approximate Student Strength
                  </label>
                  <select className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-normal">
                    <option>Under 300 Students</option>
                    <option>300 – 1,000 Students</option>
                    <option>1,000 – 2,500 Students</option>
                    <option>2,500+ Students (Multi-Branch)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="mt-4 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md transition-colors"
                >
                  Schedule Guided Demo
                </button>
              </form>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
