"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@schoolos/utils";
import { primaryButtonCls, secondaryButtonCls } from "./setup-fields";

export const PROGRESS_STEP_MS = 1600;

export function provisioningTasks(sessionLabel: string, classCount: number) {
  return [
    "Creating your school",
    `Adding the ${sessionLabel} session`,
    classCount === 1 ? "Creating 1 class" : `Creating ${classCount} classes`,
    "Setting up fee heads",
    "Opening your dashboard",
  ];
}

/**
 * Shown while the school is created. The server answers once, so the list
 * advances on a timer and holds on the last task until the redirect.
 */
export function SetupProgress({
  schoolName,
  sessionLabel,
  classCount,
}: Readonly<{ schoolName: string; sessionLabel: string; classCount: number }>) {
  const tasks = provisioningTasks(sessionLabel, classCount);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setActive((i) => Math.min(i + 1, tasks.length - 1)),
      PROGRESS_STEP_MS,
    );
    return () => clearInterval(interval);
  }, [tasks.length]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6 animate-fade-in">
      <div className="w-full max-w-sm">
        <Image
          src="/kora-icon.png"
          alt="Kora"
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
        />
        <h2 className="mt-6 text-2xl font-bold tracking-tight">
          Setting up {schoolName || "your school"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This takes a few seconds. Please keep this tab open.
        </p>
        <ol className="mt-8 space-y-4" aria-live="polite">
          {tasks.map((task, i) => {
            const state =
              i < active ? "done" : i === active ? "active" : "todo";
            return (
              <li
                key={task}
                className={cn(
                  "flex items-center gap-3 text-sm transition-colors",
                  state === "todo"
                    ? "text-muted-foreground"
                    : "text-foreground",
                  state === "active" && "font-medium",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                    state === "done" &&
                      "border-emerald-500 bg-emerald-500 text-white",
                    state === "active" &&
                      "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
                  )}
                >
                  {state === "done" && (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {state === "active" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  )}
                </span>
                {task}
                <span className="sr-only">
                  {state === "done"
                    ? " done"
                    : state === "active"
                      ? " in progress"
                      : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** U6: the school exists but its classes and session didn't get added. */
export function StarterDataRecovery({
  message,
  isRetrying,
  onRetry,
  onSkip,
}: Readonly<{
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
  onSkip: () => void;
}>) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="starter-data-title"
      aria-describedby="starter-data-message"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background px-6"
    >
      <div className="w-full max-w-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <h2
          id="starter-data-title"
          className="mt-6 text-2xl font-bold tracking-tight"
        >
          Your school is ready, almost
        </h2>
        <p
          id="starter-data-message"
          className="mt-2 text-sm text-muted-foreground"
        >
          {message} Try again now, or add them yourself later from Classes and
          Settings.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className={primaryButtonCls}
          >
            {isRetrying && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {isRetrying ? "Adding…" : "Try again"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={isRetrying}
            className={secondaryButtonCls}
          >
            Continue to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
