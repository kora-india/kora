function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function ExpensesLoading() {
  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-44" />
          <Sk className="h-4 w-64" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Sk className="h-4 w-24" />
            <Sk className="h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <Sk className="h-8 w-64 rounded-lg" />
          <Sk className="h-8 w-32 rounded-lg" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 h-12 px-5">
              <Sk className="h-4 w-40" />
              <Sk className="h-4 w-24" />
              <Sk className="h-4 w-20" />
              <Sk className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
