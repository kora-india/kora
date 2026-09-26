function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-52" />
          <Sk className="h-4 w-72" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Sk className="h-8 w-8 rounded-lg" />
            <Sk className="h-7 w-24" />
            <Sk className="h-3.5 w-32" />
            <Sk className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-24" />
            </div>
            <Sk className="h-6 w-16 rounded-full" />
          </div>
          <Sk className="h-[200px] w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Sk className="h-4 w-36" />
          <div className="flex justify-center">
            <Sk className="h-28 w-28 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Sk className="h-3 w-14 rounded" />
                <Sk className="flex-1 h-1.5 rounded-full" />
                <Sk className="h-3 w-8 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b">
            <Sk className="h-4 w-32" />
            <Sk className="h-4 w-16" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 h-11 px-5">
                <Sk className="h-7 w-7 rounded-full flex-shrink-0" />
                <Sk className="h-3.5 w-36" />
                <Sk className="h-3 w-20 ml-auto" />
                <Sk className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b">
            <Sk className="h-4 w-28" />
            <Sk className="h-4 w-10" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-1.5">
                <Sk className="h-3.5 w-3/4" />
                <Sk className="h-3 w-full" />
                <Sk className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
