"use client";

/** Pieces the fee import dialogs share. */

export function ImportStep({
  number,
  title,
  children,
}: Readonly<{ number: number; title: string; children: React.ReactNode }>) {
  return (
    <section className="flex gap-3">
      <span className="w-6 h-6 flex-shrink-0 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        {children}
      </div>
    </section>
  );
}

export function ImportTotal({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function ImportNotice({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="p-3 text-sm rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400">
      {children}
    </p>
  );
}
