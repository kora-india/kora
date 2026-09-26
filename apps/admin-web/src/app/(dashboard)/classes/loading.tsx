function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function ClassesLoading() {
  return (
    <div className="p-6 space-y-5 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-48" />
          <Sk className="h-4 w-36" />
        </div>
        <Sk className="h-9 w-28 rounded-lg" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <Sk className="w-10 h-10 rounded-xl" />
              <div className="flex gap-1">
                <Sk className="w-7 h-7 rounded-lg" />
                <Sk className="w-7 h-7 rounded-lg" />
              </div>
            </div>
            <Sk className="h-4 w-28" />
            <Sk className="h-3 w-20" />
            <div className="flex gap-1.5 flex-wrap mt-1">
              <Sk className="h-5 w-8 rounded-full" />
              <Sk className="h-5 w-8 rounded-full" />
              <Sk className="h-5 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
