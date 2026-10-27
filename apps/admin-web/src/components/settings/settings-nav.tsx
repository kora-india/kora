"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, KeyRound, Bell, Server, ShieldCheck } from "lucide-react";
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
  { label: "Change Password", href: "/settings/account", icon: KeyRound },
];

const SCHOOL_ADMIN_NAV_ITEMS = [
  SCHOOL_NAV_ITEMS[0],
  { label: "Team & Access", href: "/settings/team", icon: ShieldCheck },
  SCHOOL_NAV_ITEMS[1],
];

const SUPER_ADMIN_NAV_ITEMS = [
  { label: "Platform Overview", href: "/settings/platform", icon: Server },
  { label: "Change Password", href: "/settings/account", icon: KeyRound },
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
    <div
      id="tour-settings-tabs"
      className="flex space-x-1 p-1 bg-muted/50 rounded-xl w-fit border shadow-sm"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors z-10",
              isActive
                ? "text-violet-700 dark:text-violet-300 bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground/50 cursor-not-allowed">
        <Bell className="w-4 h-4 flex-shrink-0" />
        Notifications
        <span className="ml-1 text-[10px] uppercase tracking-wide">Soon</span>
      </div>
    </div>
  );
}
