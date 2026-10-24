import Image from "next/image";
import { BarChart3, GraduationCap, Heart } from "lucide-react";
import { cn } from "@schoolos/utils";
import { FEATURES } from "./landing-content";
import { handwriting } from "./landing-fonts";

const REPORT = [
  { subject: "English", grade: "A1" },
  { subject: "Mathematics", grade: "A2" },
  { subject: "Science", grade: "A1" },
  { subject: "Social Science", grade: "B1" },
  { subject: "Hindi", grade: "A2" },
];

/** Shown in the photo's place until public/landing/student.png exists. */
function ReportCardScene() {
  return (
    <div className="absolute bottom-[10%] left-[8%] right-[30%] top-[22%] flex flex-col rounded-2xl bg-white p-5 shadow-[0_24px_48px_-24px_rgba(76,29,149,0.45)] ring-1 ring-violet-100">
      <p className="text-xs font-medium text-violet-600">Term 1 report card</p>
      <p className="mt-1 font-semibold text-slate-900">
        Aarav Sharma · Grade 8-A
      </p>
      <ul className="mt-4 flex-1 divide-y divide-slate-100 text-sm">
        {REPORT.map((row) => (
          <li
            key={row.subject}
            className="flex items-center justify-between py-2"
          >
            <span className="text-slate-600">{row.subject}</span>
            <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              {row.grade}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">Sample data</p>
    </div>
  );
}

export function FeatureShowcase({
  photoSrc,
}: Readonly<{ photoSrc: string | null }>) {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="scroll-mt-20 overflow-hidden bg-white pt-10 sm:pt-16"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-end gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-8">
        <div className="pb-4 lg:pb-20">
          <h2
            id="features-heading"
            className="text-balance text-4xl font-extrabold tracking-[-0.025em] text-slate-950 sm:text-5xl"
          >
            Built for <span className="text-violet-600">modern schools</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            From the morning roll call to the term-end report card, Kora keeps
            your school&apos;s everyday work in one clear, simple place.
          </p>
          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {FEATURES.map(({ title, description, icon: Icon }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">
                    {title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto aspect-[10/11] w-full max-w-[540px]">
          <div className="absolute inset-x-[4%] bottom-0 aspect-square rounded-full bg-[radial-gradient(circle_at_50%_35%,#ede9fe,#ddd6fe)]" />
          {photoSrc ? (
            <Image
              src={photoSrc}
              alt="A smiling student in uniform holding her books"
              fill
              sizes="(min-width: 1024px) 540px, 90vw"
              className="object-contain object-bottom"
            />
          ) : (
            <ReportCardScene />
          )}

          <span className="absolute left-[2%] top-[30%] flex h-16 w-16 rotate-[-8deg] items-center justify-center rounded-2xl bg-white text-violet-600 shadow-[0_16px_32px_-16px_rgba(76,29,149,0.5)] ring-1 ring-violet-100">
            <BarChart3 className="h-8 w-8" aria-hidden />
          </span>
          <GraduationCap
            className="absolute right-[6%] top-[6%] h-12 w-12 rotate-[12deg] text-violet-500"
            strokeWidth={1.5}
            aria-hidden
          />
          <p
            className={cn(
              handwriting.className,
              "absolute right-0 top-[44%] rotate-[-6deg] rounded-2xl bg-white px-5 py-3 text-[1.7rem] leading-[1.05] text-violet-700 shadow-[0_18px_36px_-18px_rgba(76,29,149,0.5)] ring-1 ring-violet-100 sm:-right-2",
            )}
          >
            Better schools,
            <br />
            brighter futures
            <Heart
              className="ml-1.5 inline h-5 w-5 fill-violet-600 text-violet-600"
              aria-hidden
            />
          </p>
        </div>
      </div>
    </section>
  );
}
