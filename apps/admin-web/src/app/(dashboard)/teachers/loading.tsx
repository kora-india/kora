function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function TeachersLoading() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-32" />
          <Sk className="h-4 w-40" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      {/* Search */}
      <Sk className="h-9 w-full max-w-sm rounded-lg" />

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Sk className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="space-y-1.5">
                  <Sk className="h-3.5 w-24" />
                  <Sk className="h-3 w-16" />
                </div>
              </div>
              <Sk className="w-6 h-6 rounded-lg" />
            </div>
            <Sk className="h-3 w-40" />
            <Sk className="h-5 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
