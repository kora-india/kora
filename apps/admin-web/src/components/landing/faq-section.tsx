import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PlanCatalog } from "@/lib/plans";
import { faqs } from "./landing-content";

export function FaqSection({ plans }: Readonly<{ plans: PlanCatalog }>) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20 bg-white py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
        <div>
          <h2
            id="faq-heading"
            className="text-balance text-4xl font-extrabold tracking-[-0.025em] text-slate-950 sm:text-5xl"
          >
            Questions, <span className="text-violet-600">answered</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-slate-600">
            The quickest way to know if Kora fits your school is to try it.{" "}
            <Link
              href="/register"
              className="font-semibold text-violet-700 underline-offset-4 hover:underline"
            >
              Start a free trial
            </Link>
            .
          </p>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {faqs(plans).map((faq, i) => (
            <details key={faq.q} className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-semibold text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-violet-600 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="max-w-2xl pb-6 leading-relaxed text-slate-600">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
