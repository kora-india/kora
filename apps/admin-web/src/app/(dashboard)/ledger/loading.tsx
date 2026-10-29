function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function LedgerLoading() {
  return (
    <div className="p-4 md:p-8 pt-6 space-y-5 w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <Sk className="h-8 w-32" />
          <Sk className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Sk className="h-8 w-28 rounded-lg" />
          <Sk className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Sk className="h-9 w-72 max-w-full rounded-xl" />
        <Sk className="h-8 w-36 rounded-lg" />
        <Sk className="h-8 w-40 rounded-lg" />
        <Sk className="h-8 flex-1 min-w-52 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 space-y-2">
            <Sk className="h-3 w-20" />
            <Sk className="h-7 w-28" />
            <Sk className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <Sk className="h-10 w-full rounded-none" />
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Sk className="h-4 w-20" />
              <Sk className="h-4 w-24" />
              <Sk className="h-4 flex-1" />
              <Sk className="h-4 w-16" />
              <Sk className="h-4 w-20" />
              <Sk className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
