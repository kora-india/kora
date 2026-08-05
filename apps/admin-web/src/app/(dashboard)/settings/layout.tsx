import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your school&apos;s profile, fees, and account preferences</p>
      </div>
      <div className="flex gap-8 items-start">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
