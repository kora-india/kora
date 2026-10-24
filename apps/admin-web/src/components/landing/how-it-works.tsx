import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STEPS } from "./landing-content";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-20 bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2
              id="how-heading"
              className="text-balance text-4xl font-extrabold tracking-[-0.025em] text-slate-950 sm:text-5xl"
            >
              Start in <span className="text-violet-600">three steps</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              No installation and no paperwork. Everything happens in your
              browser.
            </p>
          </div>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-violet-700 hover:text-violet-800 lg:self-auto"
          >
            Create your account
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <span
            aria-hidden
            className="absolute left-6 right-6 top-6 hidden border-t-2 border-dashed border-violet-200 md:block"
          />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white shadow-[0_0_0_6px_#fff,0_10px_20px_-8px_rgba(124,58,237,0.7)]">
                {i + 1}
              </span>
              <h3 className="mt-6 text-lg font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-2 max-w-sm leading-relaxed text-slate-600">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
