import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@schoolos/utils";
import {
  TRIAL_DURATION_DAYS,
  formatPlanPrice,
  paidPlansByPrice,
  type PlanCatalog,
} from "@/lib/plans";

// Names, prices and features come from the live plan catalogue (U1), so this
// page shows what setup charges and what the app enforces.
export function PricingSection({ plans }: Readonly<{ plans: PlanCatalog }>) {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-20 bg-[linear-gradient(180deg,#ffffff,#f8f6ff)] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="pricing-heading"
            className="text-balance text-4xl font-extrabold tracking-[-0.025em] text-slate-950 sm:text-5xl"
          >
            Simple pricing,{" "}
            <span className="text-violet-600">no surprises</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Pay monthly, nothing renews on its own. Every plan starts with a{" "}
            {TRIAL_DURATION_DAYS}-day free trial.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {paidPlansByPrice(plans).map((plan) => {
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-2xl bg-white p-7",
                  plan.popular
                    ? "ring-2 ring-violet-600 shadow-[0_24px_48px_-24px_rgba(76,29,149,0.45)]"
                    : "ring-1 ring-slate-200",
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-7 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-950">
                    {formatPlanPrice(plan)}
                  </span>
                  <span className="text-sm text-slate-500">/ month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-violet-600"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={cn(
                    "mt-8 flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors",
                    plan.popular
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "bg-violet-50 text-violet-700 hover:bg-violet-100",
                  )}
                >
                  Start free trial
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Prices in Indian rupees. Payments go through Razorpay.
        </p>
      </div>
    </section>
  );
}
