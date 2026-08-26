function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function DashboardLayoutLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-56" />
          <Sk className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Sk className="h-9 w-28 rounded-lg" />
          <Sk className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Sk className="h-7 w-7 rounded-lg" />
              <Sk className="h-4 w-12 rounded-full" />
            </div>
            <Sk className="h-7 w-20" />
            <Sk className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Charts / Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Sk className="h-5 w-48" />
            <Sk className="h-4 w-20" />
          </div>
          <Sk className="h-[220px] w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Sk className="h-5 w-36" />
          <div className="flex justify-center py-4">
            <Sk className="h-32 w-32 rounded-full" />
          </div>
          <div className="space-y-2">
            <Sk className="h-4 w-full" />
            <Sk className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
