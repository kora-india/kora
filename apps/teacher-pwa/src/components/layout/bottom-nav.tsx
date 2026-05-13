"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Users, BookOpen, Bell } from "lucide-react";
import { cn } from "@schoolos/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/attendance", label: "Attend", icon: Calendar },
  { href: "/students", label: "Students", icon: Users },
  { href: "/assignments", label: "Tasks", icon: BookOpen },
  { href: "/notices", label: "Notices", icon: Bell },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50">
      <div className="flex items-center h-16 max-w-lg mx-auto px-2 pb-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link key={tab.href} href={tab.href} className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all active:scale-95",
              isActive ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"
            )}>
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
