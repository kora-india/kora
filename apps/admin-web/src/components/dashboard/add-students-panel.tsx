"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { ImportHistoryDialog } from "@/components/fees/import-history-dialog";
import { ImportOptions } from "@/components/students/import-options";
import { ImportStudentsDialog } from "@/components/students/import-students-dialog";
import type { FeeHistorySetup } from "@/lib/actions/fee-history";

const SKIPPED_KEY = "kora_add_students_skipped";

const readSkipped = () => {
  try {
    return localStorage.getItem(SKIPPED_KEY) === "true";
  } catch {
    return false;
  }
};

const rememberSkipped = () => {
  try {
    localStorage.setItem(SKIPPED_KEY, "true");
  } catch {
    // Private mode: it comes back on the next visit, which does no harm.
  }
};

/**
 * Onboarding's last step, for a school with no students yet: what's set up so
 * far, and the two ways to bring students in. Skipped, it leaves them on the
 * Students page.
 */
export function AddStudentsPanel({
  setup,
  classes,
}: Readonly<{
  setup: FeeHistorySetup;
  classes: {
    id: string;
    name: string;
    sections: { id: string; name: string }[];
  }[];
}>) {
  const [skipped, setSkipped] = useState(true);
  const [dialog, setDialog] = useState<"closed" | "students" | "history">(
    "closed",
  );

  useEffect(() => setSkipped(readSkipped()), []);

  if (skipped) return null;

  const steps = [
    {
      label: "Session and classes",
      value: `${setup.session?.name ?? "No session"} · ${classes.length} ${classes.length === 1 ? "class" : "classes"}`,
      done: Boolean(setup.session) && classes.length > 0,
      href: "/classes",
    },
    {
      label: "Fee heads",
      value: `${setup.feeHeadCount} ${setup.feeHeadCount === 1 ? "fee head" : "fee heads"}`,
      done: setup.feeHeadCount > 0,
      href: "/fees?tab=settings",
    },
    {
      label: "Late fee",
      value: setup.lateFeeRule ?? "Not set",
      done: Boolean(setup.lateFeeRule),
      href: "/fees?tab=settings",
    },
  ];

  return (
    <section
      aria-labelledby="add-students-title"
      className="rounded-xl border bg-card p-5 space-y-4"
    >
      <div>
        <h2 id="add-students-title" className="text-base font-bold">
          Add your students
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Check your setup below, then choose how to bring your students in. The
          fee history template uses your fee heads and late fee.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex items-start gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {step.done ? (
                <CheckCircle2
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-medium">{step.label}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {step.value}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ImportOptions
        onStudentsOnly={() => setDialog("students")}
        onWithHistory={() => setDialog("history")}
      />

      <button
        type="button"
        onClick={() => {
          rememberSkipped();
          setSkipped(true);
        }}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        Skip for now. You can do this later on the Students page.
      </button>

      <ImportStudentsDialog
        open={dialog === "students"}
        onOpenChange={(open) => !open && setDialog("closed")}
        classes={classes}
      />
      <ImportHistoryDialog
        withStudents
        open={dialog === "history"}
        onOpenChange={(open) => !open && setDialog("closed")}
      />
    </section>
  );
}
