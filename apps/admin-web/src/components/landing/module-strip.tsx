import { MODULES } from "./landing-content";

export function ModuleStrip() {
  return (
    <section
      id="modules"
      aria-labelledby="modules-heading"
      className="scroll-mt-20 bg-white py-12 sm:py-14"
    >
      <h2 id="modules-heading" className="sr-only">
        What&apos;s included
      </h2>
      <ul className="mx-auto grid max-w-7xl grid-cols-4 gap-x-2 gap-y-8 px-4 sm:px-6 lg:grid-cols-8 lg:px-8">
        {MODULES.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="group flex flex-col items-center gap-3 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 transition-colors group-hover:bg-violet-600 group-hover:text-white sm:h-16 sm:w-16">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </span>
            <span className="max-w-[8rem] text-xs font-medium leading-snug text-slate-800 sm:text-sm">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
