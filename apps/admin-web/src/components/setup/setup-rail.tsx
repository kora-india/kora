"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@schoolos/utils";
import { STEPS, type StepId } from "./setup-model";

// The auth screens' panel pattern, so register → setup reads as one flow.
const PATTERN =
  "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0ibTM2IDM0djZoNnYtNnptLTEyIDB2Nmg2di02em0wLTEydjZoNnYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')]";

export function SetupRail({
  step,
  furthestStep,
  onStepSelect,
}: Readonly<{
  step: StepId;
  furthestStep: StepId;
  onStepSelect: (step: StepId) => void;
}>) {
  return (
    <aside className="relative hidden h-screen w-[340px] shrink-0 flex-col justify-between overflow-y-auto bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-10 lg:sticky lg:top-0 lg:flex xl:w-[380px]">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-40",
          PATTERN,
        )}
      />

      <div className="relative">
        <div className="mb-12 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 p-1">
            <Image
              src="/kora-icon.png"
              alt="Kora"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Kora
          </span>
        </div>

        <p className="text-3xl font-bold leading-tight text-white">
          Set up your school
        </p>
        <p className="mt-3 text-sm leading-relaxed text-violet-200">
          Four short steps. You can change most of this later in Settings.
        </p>

        <nav aria-label="Setup steps" className="mt-10">
          <ol>
            {STEPS.map((s, i) => {
              const isCurrent = s.id === step;
              const isDone = !isCurrent && s.id < furthestStep;
              const canVisit = !isCurrent && s.id <= furthestStep;
              const isLast = i === STEPS.length - 1;
              return (
                <li key={s.id} className={cn("relative", !isLast && "pb-7")}>
                  {!isLast && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-4 top-10 -ml-px h-[calc(100%-2.75rem)] w-0.5 rounded-full transition-colors duration-300",
                        s.id < furthestStep ? "bg-white/70" : "bg-white/20",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!canVisit}
                    onClick={() => onStepSelect(s.id)}
                    aria-current={isCurrent ? "step" : undefined}
                    className="group flex w-full items-start gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-violet-700 disabled:cursor-default"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all duration-300",
                        isDone && "border-white bg-white text-violet-700",
                        isCurrent &&
                          "border-white bg-white/15 text-white ring-4 ring-white/15",
                        !isDone &&
                          !isCurrent &&
                          "border-white/30 text-violet-200",
                        canVisit &&
                          "group-hover:ring-4 group-hover:ring-white/20",
                      )}
                    >
                      {isDone ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        s.id
                      )}
                    </span>
                    <span className="pt-1">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          isDone || isCurrent
                            ? "text-white"
                            : "text-violet-200",
                          canVisit &&
                            "group-hover:underline underline-offset-4",
                        )}
                      >
                        {s.label}
                        <span className="sr-only">
                          {isCurrent
                            ? " (current step)"
                            : isDone
                              ? " (done)"
                              : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-violet-200">
                        {s.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="relative mt-10 rounded-xl border border-white/10 bg-white/10 p-4">
        <p className="text-sm font-medium text-white">
          When you finish, we&apos;ll add
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-violet-200">
          {[
            "Your academic session",
            "Each class you select, with Section A",
            "Common fee heads like tuition and transport",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check
                className="mt-px h-3.5 w-3.5 shrink-0 text-white/80"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
