function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function AssignmentsLoading() {
  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-44" />
          <Sk className="h-4 w-64" />
        </div>
        <Sk className="h-9 w-36 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Sk className="h-5 w-20 rounded" />
              <Sk className="h-4 w-16" />
            </div>
            <Sk className="h-5 w-44" />
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-2/3" />
            <div className="pt-2 border-t flex justify-between">
              <Sk className="h-4 w-24" />
              <Sk className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
