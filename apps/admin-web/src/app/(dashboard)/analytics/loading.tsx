function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-52" />
          <Sk className="h-4 w-80" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Sk className="h-4 w-24" />
              <Sk className="h-4 w-4 rounded-full" />
            </div>
            <Sk className="h-7 w-20" />
            <Sk className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Sk className="h-5 w-44" />
          <Sk className="h-3 w-64" />
          <div className="space-y-4 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Sk className="h-3.5 w-28" />
                  <Sk className="h-3.5 w-20" />
                </div>
                <Sk className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Sk className="h-5 w-44" />
          <Sk className="h-3 w-64" />
          <div className="flex justify-center py-6">
            <Sk className="h-36 w-36 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Sk className="h-7 w-full rounded" />
            <Sk className="h-7 w-full rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
