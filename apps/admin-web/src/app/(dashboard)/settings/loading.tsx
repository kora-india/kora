function Sk({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

function CardSk({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
        <Sk className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Sk className="h-4 w-36" />
          <Sk className="h-3 w-56" />
        </div>
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        {Array.from({ length: rows }, (_, i) => (
          <Sk key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CardSk rows={4} />
        <CardSk rows={2} />
      </div>
      <CardSk rows={3} />
    </div>
  );
}
