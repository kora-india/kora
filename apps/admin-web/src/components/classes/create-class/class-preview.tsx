"use client";

import { Eye, UserRound } from "lucide-react";
import { sectionLabel, type ClassCategoryId } from "@/lib/class-catalog";
import { CategoryIcon } from "./class-selector";

interface ClassPreviewProps {
  className: string | null;
  category: ClassCategoryId | null;
  sections: string[];
  teacherName: string | null;
}

export function ClassPreview({
  className,
  category,
  sections,
  teacherName,
}: Readonly<ClassPreviewProps>) {
  return (
    <section
      aria-label="Class preview"
      aria-live="polite"
      className="rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-violet-600 dark:text-violet-300" />
        <p className="text-sm font-semibold">Class preview</p>
        <span className="text-xs text-muted-foreground">
          · what will be created
        </span>
      </div>

      {className ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="rounded-lg border bg-card p-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {category && <CategoryIcon category={category} />}
              <p className="text-sm font-semibold truncate" title={className}>
                {className}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sections.length === 0
                ? "No sections yet"
                : `${sections.length} section${sections.length === 1 ? "" : "s"}`}
            </p>
            {sections.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {sections.map((s) => (
                  <span
                    key={s}
                    title={sectionLabel(className, s)}
                    className="max-w-[12rem] truncate text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                  >
                    {sectionLabel(className, s)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Students can only be enrolled once a section exists. You can add
                sections later.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:min-w-[10rem]">
            <div className="w-8 h-8 rounded-full bg-card border flex items-center justify-center flex-shrink-0">
              <UserRound className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Class teacher</p>
              <p
                className="text-sm font-medium truncate"
                title={teacherName ?? undefined}
              >
                {teacherName ?? (
                  <span className="text-muted-foreground font-normal">
                    Not assigned
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a class to see a preview of its sections.
        </p>
      )}
    </section>
  );
}
