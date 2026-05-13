function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function StudentsLoading() {
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Sk className="h-9 flex-1 min-w-[200px] max-w-sm rounded-lg" />
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              {["Student", "Admission No.", "Class", "Parent", "Fee Status", "Actions"].map((h) => (
                <th key={h} className="h-10 px-5 text-left">
                  <Sk className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td className="h-12 px-5">
                  <div className="flex items-center gap-2.5">
                    <Sk className="w-7 h-7 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5">
                      <Sk className="h-3 w-28" />
                      <Sk className="h-2.5 w-16" />
                    </div>
                  </div>
                </td>
                <td className="h-12 px-4"><Sk className="h-3 w-20" /></td>
                <td className="h-12 px-4"><Sk className="h-3 w-16" /></td>
                <td className="h-12 px-4">
                  <div className="space-y-1.5">
                    <Sk className="h-3 w-24" />
                    <Sk className="h-2.5 w-20" />
                  </div>
                </td>
                <td className="h-12 px-4"><Sk className="h-5 w-16 rounded-full" /></td>
                <td className="h-12 px-4"><Sk className="h-6 w-6 rounded-lg" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
