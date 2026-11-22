import type { LucideIcon } from "lucide-react";
import { cn } from "@schoolos/utils";

interface SettingsCardProps {
  title: string;
  description?: string;
  /** Shown in a tinted tile beside the title. */
  icon?: LucideIcon;
  action?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export function SettingsCard({
  title,
  description,
  icon: Icon,
  action,
  id,
  className,
  children,
}: Readonly<SettingsCardProps>) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-2xl border bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 px-5 py-4 sm:px-6 border-b">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-6">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
