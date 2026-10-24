import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TRIAL } from "./landing-content";

export function CtaBand() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="bg-white px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8"
    >
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#6d28d9,#7c3aed_55%,#5b21b6)] px-6 py-12 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:py-14">
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 text-white/10"
          viewBox="0 0 320 320"
          fill="none"
        >
          <circle cx="160" cy="160" r="159" stroke="currentColor" />
          <circle cx="160" cy="160" r="110" stroke="currentColor" />
        </svg>
        <div className="relative max-w-2xl">
          <h2
            id="cta-heading"
            className="text-balance text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl"
          >
            Transform your school today
          </h2>
          <p className="mt-3 text-lg text-violet-100">
            Try every {TRIAL.planName} feature free for {TRIAL.days} days, and
            see your school run more simply.
          </p>
        </div>
        <div className="relative flex flex-col items-start gap-3 lg:items-center">
          <Link
            href="/register"
            className="group flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-violet-700 shadow-[0_12px_28px_-12px_rgba(15,23,42,0.5)] transition-colors hover:bg-violet-50"
          >
            Start free trial
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <p className="text-sm text-violet-100">No payment needed to start</p>
        </div>
      </div>
    </section>
  );
}
