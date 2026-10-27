"use client";

import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Check, Play } from "lucide-react";
import { cn } from "@schoolos/utils";
import {
  DashboardMockup,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
} from "./dashboard-mockup";
import { ScaleToFit } from "./scale-to-fit";
import { handwriting } from "./landing-fonts";
import { TRIAL_DURATION_DAYS } from "@/lib/plans";

const ease = [0.22, 1, 0.36, 1] as const;

// The same props on server and client; MotionConfig drops the movement
// (keeping the fade) for people who ask for reduced motion.
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease },
});

export function HeroSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f3efff_0%,#f8f6ff_60%,#ffffff_100%)] pb-16 pt-28 lg:pb-24 lg:pt-36">
        {/* Two thin arcs echo the curve around the product in the reference. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-40 top-24 hidden h-[640px] w-[900px] lg:block"
          viewBox="0 0 900 640"
          fill="none"
        >
          <ellipse
            cx="470"
            cy="330"
            rx="420"
            ry="250"
            stroke="#c4b5fd"
            strokeOpacity="0.45"
          />
          <ellipse
            cx="470"
            cy="330"
            rx="350"
            ry="300"
            stroke="#ddd6fe"
            strokeOpacity="0.6"
            transform="rotate(-18 470 330)"
          />
        </svg>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] lg:gap-10 lg:px-8">
          <div className="max-w-xl">
            <motion.h1
              {...rise(0)}
              className="text-balance text-[2.5rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-[3.5rem]"
            >
              Simplify school operations, empower{" "}
              <span className="text-violet-600">better education</span>
            </motion.h1>
            <motion.p
              {...rise(0.08)}
              className="mt-6 text-lg leading-relaxed text-slate-600"
            >
              Kora brings students, staff, fees, attendance, exams and transport
              into one simple platform, built for the way Indian schools run.
            </motion.p>

            <motion.div
              {...rise(0.16)}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/register"
                className="group flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.75)] transition-colors hover:bg-violet-700"
              >
                Start free trial
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <a
                href="#how-it-works"
                className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-violet-200 bg-white px-6 text-base font-semibold text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white">
                  <Play className="ml-0.5 h-3 w-3 fill-current" aria-hidden />
                </span>
                See how it works
              </a>
            </motion.div>

            <motion.ul
              {...rise(0.24)}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600"
            >
              {[
                `${TRIAL_DURATION_DAYS}-day free trial`,
                "No payment to start",
                "Set up in four steps",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check
                    className="h-4 w-4 text-violet-600"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </motion.ul>
          </div>

          <div className="relative lg:pt-10">
            <p
              className={cn(
                handwriting.className,
                "absolute -top-6 right-2 z-10 hidden rotate-[-5deg] text-[1.65rem] leading-[1.05] text-violet-700 lg:block",
              )}
            >
              Everything your school
              <br />
              needs, in one place.
            </p>
            <svg
              aria-hidden
              className="absolute -top-1 right-[15.5rem] z-10 hidden h-14 w-16 text-violet-500 lg:block"
              viewBox="0 0 64 56"
              fill="none"
            >
              <path
                d="M58 6C40 4 22 12 14 34"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 26l8 9 9-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease }}
              className="[perspective:1800px]"
            >
              <div
                role="img"
                aria-label="Kora's dashboard with sample data: student, teacher and class counts, fees collected, attendance this session and the latest notices"
                className="origin-left lg:[transform:rotateY(-9deg)_rotateX(4deg)]"
              >
                <ScaleToFit width={MOCKUP_WIDTH} height={MOCKUP_HEIGHT}>
                  <div className="rounded-2xl shadow-[0_40px_80px_-32px_rgba(76,29,149,0.45),0_12px_28px_-12px_rgba(15,23,42,0.18)]">
                    <DashboardMockup />
                  </div>
                </ScaleToFit>
              </div>
            </motion.div>
            <p className="mt-4 text-right text-xs text-slate-400">
              Sample data
            </p>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
