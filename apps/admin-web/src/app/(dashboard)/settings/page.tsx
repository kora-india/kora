export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">Manage school profile and configuration</p>
      <div className="space-y-4">
        {["School Profile", "Notifications", "Academic Year", "Fee Configuration", "Backup & Export"].map((s) => (
          <div key={s} className="rounded-xl border bg-card p-4 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer">
            <span className="text-sm font-medium">{s}</span>
            <span className="text-muted-foreground text-xs">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}
