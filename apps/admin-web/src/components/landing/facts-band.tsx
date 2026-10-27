import type { PlanCatalog } from "@/lib/plans";
import { facts } from "./landing-content";

export function FactsBand({ plans }: Readonly<{ plans: PlanCatalog }>) {
  return (
    <section
      aria-labelledby="facts-heading"
      className="bg-white px-4 sm:px-6 lg:px-8"
    >
      <h2 id="facts-heading" className="sr-only">
        Kora at a glance
      </h2>
      <ul className="mx-auto grid max-w-7xl gap-3 rounded-3xl bg-violet-50/70 p-3 ring-1 ring-violet-100 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
        {facts(plans).map(({ value, label, icon: Icon }) => (
          <li
            key={value}
            className="flex items-center gap-4 rounded-2xl bg-white px-5 py-5 shadow-[0_6px_16px_-10px_rgba(76,29,149,0.25)]"
          >
            <Icon
              className="h-8 w-8 shrink-0 text-violet-600"
              strokeWidth={1.75}
              aria-hidden
            />
            <span>
              <span className="block text-2xl font-bold tracking-tight text-violet-700">
                {value}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                {label}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
