"use client";

import { Star, Quote, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function TestimonialsSection() {
  const demoTestimonials = [
    {
      quote:
        "Kora has made our fee management so much easier. My office team finally knows exactly what is pending without cross-checking three different handwritten registers.",
      author: "Dr. Sunita Rao",
      role: "Principal",
      school: "Bright Valley Senior Secondary School",
      tag: "Representative Feedback",
      avatar: "SR",
    },
    {
      quote:
        "Morning attendance used to take 20 minutes out of our first period. With Kora, teachers finish it on their mobile in 45 seconds, and parents are instantly notified if their child is absent.",
      author: "Rajesh K. Mehta",
      role: "Director of Academics",
      school: "Oakridge Model Academy",
      tag: "Representative Feedback",
      avatar: "RM",
    },
    {
      quote:
        "Receipt generation and fee reconciliation are completely painless now. We haven't had a single parent dispute about payment history since we started using Kora.",
      author: "Priya Sharma",
      role: "Head of Accounts",
      school: "St. Xavier's International School",
      tag: "Representative Feedback",
      avatar: "PS",
    },
  ];

  return (
    <section
      id="testimonials"
      className="py-24 bg-slate-50/60 border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Educator Endorsements</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            What School Leaders Say About Kora
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Hear how school principals, trustees, and administrative staff
            transformed their everyday workflow.
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {demoTestimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* 5 Stars Rating */}
                <div className="flex items-center gap-1 text-amber-400 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>

                <Quote className="w-8 h-8 text-violet-200 mb-3" />

                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {t.author}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {t.role} • {t.school}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-slate-400 mt-0.5">
                    {t.tag}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          * Representative customer testimonials for demo deployment. Contact
          our team to speak directly with reference school directors in your
          region.
        </p>
      </div>
    </section>
  );
}
