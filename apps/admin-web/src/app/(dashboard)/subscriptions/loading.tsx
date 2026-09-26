function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function SubscriptionsLoading() {
  return (
    <div className="p-6 space-y-8 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-64" />
          <Sk className="h-4 w-96" />
        </div>
        <Sk className="h-12 w-44 rounded-lg" />
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Sk className="h-5 w-20 rounded" />
              <Sk className="h-4 w-16" />
            </div>
            <Sk className="h-9 w-28" />
            <Sk className="h-3 w-full" />
            <div className="space-y-2 py-4 border-y">
              <Sk className="h-4 w-full" />
              <Sk className="h-4 w-full" />
            </div>
            <div className="space-y-2">
              <Sk className="h-3 w-3/4" />
              <Sk className="h-3 w-2/3" />
              <Sk className="h-3 w-4/5" />
            </div>
            <Sk className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <Sk className="h-5 w-48" />
          <Sk className="h-7 w-64 rounded-lg" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 h-12 px-5">
              <Sk className="h-4 w-36" />
              <Sk className="h-3 w-24 font-mono" />
              <Sk className="h-5 w-16 rounded-full" />
              <Sk className="h-3.5 w-28" />
              <Sk className="h-3.5 w-28" />
              <Sk className="h-7 w-20 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
