function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function AttendanceLoading() {
  return (
    <div className="p-6 space-y-5 w-full">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-40" />
          <Sk className="h-4 w-52" />
        </div>
        <Sk className="h-9 w-28 rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Sk className="h-8 w-8 rounded-lg" />
            <Sk className="h-7 w-16" />
            <Sk className="h-3.5 w-28" />
          </div>
        ))}
      </div>

      {/* Class list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b">
          <Sk className="h-4 w-40" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Sk className="w-10 h-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Sk className="h-3.5 w-24" />
                  <Sk className="h-3 w-32" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Sk className="h-2 w-24 rounded-full" />
                <Sk className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
