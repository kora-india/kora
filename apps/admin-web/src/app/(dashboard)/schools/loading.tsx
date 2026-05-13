function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function SchoolsLoading() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-24" />
          <Sk className="h-4 w-44" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Sk className="w-10 h-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Sk className="h-4 w-32" />
                  <Sk className="h-3 w-24" />
                </div>
              </div>
              <Sk className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-lg bg-muted/50 p-2 space-y-1">
                  <Sk className="h-5 w-10" />
                  <Sk className="h-3 w-14" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t">
              <Sk className="h-7 flex-1 rounded-lg" />
              <Sk className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
