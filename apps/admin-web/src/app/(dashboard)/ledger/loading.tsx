function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function LedgerLoading() {
  return (
    <div className="p-4 md:p-8 pt-6 space-y-6 max-w-[1400px]">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Sk className="h-8 w-60" />
          <Sk className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Sk className="h-9 w-28 rounded-lg" />
          <Sk className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Filter Deck Skeleton */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sk key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <Sk className="h-9 w-full rounded-lg" />
          <Sk className="h-9 w-full rounded-lg" />
          <Sk className="h-9 w-full rounded-lg" />
          <Sk className="h-9 w-full rounded-lg" />
        </div>
      </div>

      {/* Master KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex justify-between items-start">
              <Sk className="h-4 w-24" />
              <Sk className="h-8 w-8 rounded-lg" />
            </div>
            <Sk className="h-7 w-28" />
            <Sk className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Payment Channel Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Sk className="h-4 w-28" />
            <Sk className="h-6 w-32" />
            <Sk className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Breakdown Grids Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Sk className="h-5 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Sk className="h-4 w-32" />
                  <Sk className="h-4 w-20" />
                </div>
                <Sk className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Sk className="h-5 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Sk className="h-4 w-32" />
                  <Sk className="h-4 w-20" />
                </div>
                <Sk className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
