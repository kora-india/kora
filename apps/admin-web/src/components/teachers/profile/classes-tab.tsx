"use client";

import { Award, BookOpen } from "lucide-react";
import { teachingClasses, type ProfileTeacher } from "./types";

export function ClassesTab({ teacher }: Readonly<{ teacher: ProfileTeacher }>) {
  const classes = teachingClasses(teacher);

  // Group sections under their class: "LKG" → [LKG-A, LKG-B, …].
  const groups = new Map<string, { name: string; labels: string[] }>();
  for (const c of classes) {
    const g = groups.get(c.classId) ?? { name: c.className, labels: [] };
    g.labels.push(c.label);
    groups.set(c.classId, g);
  }

  if (teacher.classTeacherOf.length === 0 && classes.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-14 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-6 h-6 text-muted-foreground opacity-60" />
        </div>
        <p className="text-sm font-semibold">
          No classes assigned to this teacher.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use Edit Teacher to assign teaching classes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Class Teacher
        </h3>
        {teacher.classTeacherOf.length > 0 ? (
          <ul className="space-y-2">
            {teacher.classTeacherOf.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5"
              >
                <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{c.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not a class teacher for any class.
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Teaching Classes
          {classes.length > 0 && (
            <span className="ml-2 normal-case tracking-normal font-normal">
              ({classes.length} section{classes.length === 1 ? "" : "s"})
            </span>
          )}
        </h3>
        {groups.size > 0 ? (
          <ul className="divide-y">
            {[...groups.entries()].map(([id, g]) => (
              <li
                key={id}
                className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <span className="text-sm font-medium sm:w-32 flex-shrink-0 truncate">
                  {g.name}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {g.labels.map((l) => (
                    <span
                      key={l}
                      className="px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No teaching classes assigned.
          </p>
        )}
      </section>
    </div>
  );
}
