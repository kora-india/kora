"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Is Kora difficult to set up?",
      a: "Not at all. You can set up your school in under 10 minutes from any web browser. Our onboarding team is also available to help you configure classes, fees, and staff logins if you need assistance.",
    },
    {
      q: "Can teachers use Kora from their phones?",
      a: "Yes! Teachers can open Kora directly on any smartphone (Android or iPhone) without downloading bulky software. They can mark attendance, check timetables, and view student lists in seconds.",
    },
    {
      q: "Can I manage fees and print receipts?",
      a: "Yes. You can track term fees, transport charges, concessions, and advance balances. Official PDF receipts can be printed immediately or dispatched straight to parents via WhatsApp.",
    },
    {
      q: "Can parents receive updates and circulars?",
      a: "Yes. Whenever you publish an announcement, exam timetable, or rain holiday notice, parents receive it instantly on their mobile phones.",
    },
    {
      q: "Can Kora manage school transport?",
      a: "Yes. Kora lets you organize buses, driver contact details, stops, and passenger lists, and automatically bills transport fees based on distance or stop.",
    },
    {
      q: "Can multiple staff members use it at the same time?",
      a: "Yes. Principals, teachers, accountants, and front-desk staff can all work simultaneously with their own secure logins, seeing only the modules relevant to their role.",
    },
    {
      q: "Can I move our existing school data into Kora?",
      a: "Yes. You can import student rosters, staff lists, and class sections directly from Excel spreadsheets with our 1-click import feature. Our support team can also assist with migration.",
    },
    {
      q: "How does the free trial work?",
      a: "You get 14 days of full access to all Kora features with zero obligation. No credit card is required to get started, and you can invite your staff to test it with you.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Everything you need to know about getting started with Kora.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="mt-14 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 overflow-hidden transition-colors bg-white hover:border-slate-300"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                >
                  <span className="font-bold text-base text-slate-900">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? "rotate-180 text-violet-600" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-5 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Still have questions banner */}
        <div className="mt-12 p-6 rounded-3xl bg-violet-50 border border-violet-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                Have a specific question about your school?
              </p>
              <p className="text-xs text-slate-500">
                Our education team is happy to answer any questions.
              </p>
            </div>
          </div>
          <a
            href="#final-cta"
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-violet-700 font-bold text-xs border border-violet-200 shadow-sm transition-colors"
          >
            Chat With Us
          </a>
        </div>
      </div>
    </section>
  );
}
