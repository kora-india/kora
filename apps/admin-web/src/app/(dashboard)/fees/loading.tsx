function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function FeesLoading() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-44" />
          <Sk className="h-4 w-56" />
        </div>
        <Sk className="h-9 w-28 rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Sk className="h-8 w-8 rounded-lg" />
            <Sk className="h-6 w-28" />
            <Sk className="h-3.5 w-36" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <Sk className="h-4 w-24" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Sk key={i} className="h-6 w-14 rounded-full" />
            ))}
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              {["Student", "Class", "Fee Type", "Amount", "Due Date", "Status", "Actions"].map((h) => (
                <th key={h} className="h-10 px-5 text-left">
                  <Sk className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td className="h-12 px-5"><Sk className="h-3 w-28" /></td>
                <td className="h-12 px-4"><Sk className="h-3 w-16" /></td>
                <td className="h-12 px-4"><Sk className="h-3 w-24" /></td>
                <td className="h-12 px-4"><Sk className="h-3 w-16" /></td>
                <td className="h-12 px-4"><Sk className="h-3 w-20" /></td>
                <td className="h-12 px-4"><Sk className="h-5 w-16 rounded-full" /></td>
                <td className="h-12 px-4 flex items-center gap-2">
                  <Sk className="h-3 w-16" />
                  <Sk className="h-6 w-6 rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
