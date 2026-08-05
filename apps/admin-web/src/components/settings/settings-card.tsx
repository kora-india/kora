interface SettingsCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsCard({ title, description, action, children }: Readonly<SettingsCardProps>) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5 border-b">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
