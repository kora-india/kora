"use client";

import { FileSpreadsheet, History, type LucideIcon } from "lucide-react";

function Option({
  icon: Icon,
  title,
  description,
  onClick,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 p-4 text-left border rounded-xl bg-background hover:bg-muted/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center">
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

/** The two ways to bring students in, on the dashboard and the Students page. */
export function ImportOptions({
  onStudentsOnly,
  onWithHistory,
}: Readonly<{ onStudentsOnly: () => void; onWithHistory: () => void }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Option
        icon={FileSpreadsheet}
        title="Import students only"
        description="Upload any spreadsheet of your students. You can bring in their fee history later."
        onClick={onStudentsOnly}
      />
      <Option
        icon={History}
        title="Import students with fee history"
        description="Download a blank template with your fee heads and late fee, fill it in, and upload it all at once."
        onClick={onWithHistory}
      />
    </div>
  );
}
