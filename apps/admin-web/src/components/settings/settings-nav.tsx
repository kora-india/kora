"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, KeyRound, Bell } from "lucide-react";
import { cn } from "@schoolos/utils";

const NAV_ITEMS = [
  { label: "School Profile", href: "/settings/school-profile", icon: Building2 },
  { label: "Change Password", href: "/settings/account", icon: KeyRound },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 flex-shrink-0 space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-violet-50 text-violet-700 font-medium dark:bg-violet-900/30 dark:text-violet-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground/60 cursor-not-allowed">
        <Bell className="w-4 h-4 flex-shrink-0" />
        Notifications
        <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
      </div>
    </nav>
  );
}
