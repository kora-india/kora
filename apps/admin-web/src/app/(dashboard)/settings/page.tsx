import Link from "next/link";

const LINKED_SECTIONS = [
  { label: "School Profile", href: "/settings/school-profile" },
  { label: "Fee Configuration", href: "/settings/fee-types" },
  { label: "Change Password", href: "/settings/account" },
];

const INERT_SECTIONS = ["Notifications"];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">Manage school profile and configuration</p>
      <div className="space-y-4">
        {LINKED_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border bg-card p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
          >
            <span className="text-sm font-medium">{s.label}</span>
            <span className="text-muted-foreground text-xs">→</span>
          </Link>
        ))}
        {INERT_SECTIONS.map((s) => (
          <div key={s} className="rounded-xl border bg-card p-4 flex items-center justify-between opacity-60">
            <span className="text-sm font-medium">{s}</span>
            <span className="text-muted-foreground text-xs">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
