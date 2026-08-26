function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Sk className="h-5 w-48" />
        <Sk className="h-3 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Sk className="h-16 rounded-lg" />
          <Sk className="h-16 rounded-lg" />
          <Sk className="h-16 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Sk className="h-5 w-44" />
        <Sk className="h-3 w-64" />
        <div className="space-y-3 pt-2">
          <Sk className="h-8 w-full" />
          <Sk className="h-8 w-full" />
          <Sk className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}
