function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export default function TeacherProfileLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <Sk className="h-4 w-36" />
      <div className="flex items-center gap-4">
        <Sk className="w-14 h-14 rounded-full" />
        <div className="space-y-2">
          <Sk className="h-6 w-48" />
          <Sk className="h-4 w-32" />
        </div>
      </div>
      <div className="flex gap-4 border-b pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk key={i} className="h-5 w-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Sk className="h-4 w-40" />
            <Sk className="h-3.5 w-full" />
            <Sk className="h-3.5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
