"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Bell, Server, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@schoolos/utils";
import { UserRole } from "@schoolos/types";

interface SettingsNavProps {
  userRole?: UserRole;
}

const SCHOOL_NAV_ITEMS = [
  {
    label: "School Profile",
    href: "/settings/school-profile",
    icon: Building2,
  },
  { label: "Account", href: "/settings/account", icon: UserRound },
];

const SCHOOL_ADMIN_NAV_ITEMS = [
  SCHOOL_NAV_ITEMS[0],
  { label: "Team & Access", href: "/settings/team", icon: ShieldCheck },
  SCHOOL_NAV_ITEMS[1],
];

const SUPER_ADMIN_NAV_ITEMS = [
  { label: "Platform Overview", href: "/settings/platform", icon: Server },
  { label: "Account", href: "/settings/account", icon: UserRound },
];

// Team & Access is the school admin's: teachers and accountants don't see it.
function navItemsFor(role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) return SUPER_ADMIN_NAV_ITEMS;
  if (role === UserRole.SCHOOL_ADMIN) return SCHOOL_ADMIN_NAV_ITEMS;
  return SCHOOL_NAV_ITEMS;
}

export function SettingsNav({
  userRole = UserRole.SCHOOL_ADMIN,
}: Readonly<SettingsNavProps>) {
  const pathname = usePathname();
  const navItems = navItemsFor(userRole);

  return (
    <nav
      id="tour-settings-tabs"
      aria-label="Settings sections"
      className="flex gap-1 p-1.5 bg-card rounded-2xl w-fit max-w-full overflow-x-auto border shadow-sm"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-shrink-0 items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap transition-colors",
              isActive
                ? "bg-violet-600 text-white shadow-sm"
                : "text-foreground/80 hover:text-foreground hover:bg-muted",
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <span
        aria-disabled="true"
        className="flex flex-shrink-0 items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap text-muted-foreground cursor-not-allowed"
      >
        <Bell className="w-4 h-4 flex-shrink-0" aria-hidden />
        Notifications
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          Soon
        </span>
      </span>
    </nav>
  );
}
