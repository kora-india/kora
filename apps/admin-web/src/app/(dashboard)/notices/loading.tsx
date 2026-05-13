function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function NoticesLoading() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-32" />
          <Sk className="h-4 w-44" />
        </div>
        <Sk className="h-9 w-36 rounded-lg" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Sk className="h-5 w-16 rounded-full" />
                <Sk className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex gap-2">
                <Sk className="h-7 w-7 rounded-lg" />
                <Sk className="h-7 w-7 rounded-lg" />
              </div>
            </div>
            <Sk className="h-4 w-2/3" />
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-5/6" />
            <div className="flex items-center gap-2 pt-1">
              <Sk className="h-5 w-5 rounded-full" />
              <Sk className="h-3 w-24" />
              <Sk className="h-3 w-20 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
