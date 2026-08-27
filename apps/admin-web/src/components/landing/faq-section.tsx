"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How fast can our school migrate from Excel or our existing software?",
      a: "Migration takes less than 5 minutes. You can import your entire student and teacher roster via our Excel/CSV bulk import wizard. Classes, sections, and fee structures are automatically generated.",
    },
    {
      q: "How does the Advance Ledger and auto-reconciliation feature work?",
      a: "When a parent pays more than the billed amount, the surplus is automatically deposited into the student's Advance Ledger. On the 1st of every month when new fees are generated, SchoolOS automatically deducts the advance balance and presents the exact remaining payable amount.",
    },
    {
      q: "Do teachers need to download an app from the Play Store or App Store?",
      a: "No. SchoolOS includes a dedicated Progressive Web App (PWA). Teachers simply visit your school link on any mobile device (iOS/Android) and take attendance with zero install friction and instant cloud synchronization.",
    },
    {
      q: "Can a teacher be assigned to multiple classes and sections?",
      a: "Yes. SchoolOS supports multi-class and multi-section assignment with Ant Design multi-select. Teachers can be assigned as designated Class Teachers while also teaching specific subjects across multiple grade sections.",
    },
    {
      q: "How does distance-based transport route billing calculate fees?",
      a: "You define route stops with their distance from the school in kilometers. When enrolling a student at a stop, SchoolOS calculates the monthly fee based on distance rates and trip type (Pickup only, Drop only, or Two-way) and links it directly to their monthly fee charges.",
    },
    {
      q: "How secure is our school's student and financial data?",
      a: "SchoolOS enforces multi-tenant row-level security in PostgreSQL. Every query is partitioned by your school's unique ID. We use industry-standard encryption at rest and in transit with automated cloud backups.",
    },
  ];

  return (
    <section id="faq" className="py-24 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-wider mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Got Questions? We’ve Got Answers.
          </h2>
          <p className="mt-4 text-base text-white/60">
            Everything you need to know about switching to SchoolOS.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden transition-colors hover:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-white text-base sm:text-lg focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-violet-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="px-6 pb-6 text-sm sm:text-base text-white/65 leading-relaxed"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
