"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DollarSign,
  Calendar,
  Megaphone,
  BookOpen,
  Settings,
  ChevronLeft,
  GraduationCap as Logo,
  Building2,
  BarChart3,
  Wallet,
  CreditCard,
  Loader2,
  Bus,
  Award,
  Clock,
} from "lucide-react";
import { cn } from "@schoolos/utils";
import { UserRole } from "@schoolos/types";

interface SidebarProps {
  userRole: UserRole;
  schoolName?: string;
}

const adminNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Teachers / Staff", href: "/teachers", icon: GraduationCap },
  { label: "Classes", href: "/classes", icon: BookOpen },
  { label: "Timetable", href: "/timetable", icon: Clock },
  { label: "Attendance", href: "/attendance", icon: Calendar },
  { label: "Exams & Results", href: "/exams", icon: Award },
  { label: "Fees", href: "/fees", icon: DollarSign },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Transport", href: "/transport", icon: Bus },
  { label: "Assignments", href: "/assignments", icon: BookOpen },
  { label: "Notices", href: "/notices", icon: Megaphone },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const superAdminNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Schools", href: "/schools", icon: Building2 },
  { label: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const teacherNavItems = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Timetable", href: "/timetable", icon: Clock },
  { label: "Attendance", href: "/attendance", icon: Calendar },
  { label: "Exams & Marks", href: "/exams", icon: Award },
  { label: "Students", href: "/students", icon: Users },
  { label: "Transport", href: "/transport", icon: Bus },
  { label: "Assignments", href: "/assignments", icon: BookOpen },
  { label: "Notices", href: "/notices", icon: Megaphone },
];

const accountantNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Fees", href: "/fees", icon: DollarSign },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Transport", href: "/transport", icon: Bus },
  { label: "Payments", href: "/payments", icon: BarChart3 },
  { label: "Students", href: "/students", icon: Users },
];

function getNavItems(role: UserRole) {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return superAdminNavItems;
    case UserRole.TEACHER:
      return teacherNavItems;
    case UserRole.ACCOUNTANT:
      return accountantNavItems;
    default:
      return adminNavItems;
  }
}

function getRoleBadge(role: UserRole) {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return {
        label: "Super Admin",
        className:
          "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
      };
    case UserRole.SCHOOL_ADMIN:
      return {
        label: "Admin",
        className:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
      };
    case UserRole.TEACHER:
      return {
        label: "Teacher",
        className:
          "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
      };
    case UserRole.ACCOUNTANT:
      return {
        label: "Accounts",
        className:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
      };
  }
}

export function Sidebar({ userRole, schoolName }: Readonly<SidebarProps>) {
  const [collapsed, setCollapsed] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const pathname = usePathname();
  const navItems = getNavItems(userRole);
  const roleBadge = getRoleBadge(userRole);

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex flex-col h-screen bg-card border-r overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 px-4 border-b gap-3",
          collapsed && "justify-center",
        )}
      >
        <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Logo className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="font-bold text-sm tracking-tight whitespace-nowrap"
            >
              SchoolOS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* School info */}
      {!collapsed && schoolName && (
        <div className="px-3 py-2.5 border-b">
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <p className="text-xs font-medium truncate">{schoolName}</p>
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                roleBadge.className,
              )}
            >
              {roleBadge.label}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const isLoading = navigatingTo === item.href;
          return (
            <Link
              key={item.href}
              id={`tour-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              href={item.href}
              onClick={() => {
                if (pathname !== item.href) {
                  setNavigatingTo(item.href);
                }
              }}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                isActive
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive
                    ? "text-violet-600 dark:text-violet-400"
                    : "group-hover:text-foreground",
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap flex-1"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && isLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600 dark:text-violet-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
            collapsed && "justify-center px-2",
          )}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
