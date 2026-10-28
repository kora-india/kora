"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

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
  Building2,
  BarChart3,
  Wallet,
  CreditCard,
  Loader2,
  Bus,
  Award,
  Clock,
  Zap,
  Crown,
  Shield,
  Sparkles,
  ReceiptText,
  X,
} from "lucide-react";
import { cn } from "@schoolos/utils";
import { useIsDesktop, useMobileNav } from "./mobile-nav";
import {
  UserRole,
  can,
  type PermissionModule,
  type Permissions,
} from "@schoolos/types";

interface SidebarProps {
  userRole: UserRole;
  /** A teacher's or accountant's permissions; they decide the menu. */
  permissions?: Permissions;
  schoolName?: string;
  schoolPlan?: string;
  planName?: string;
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
  { label: "Ledger", href: "/ledger", icon: ReceiptText },
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
  { label: "Ledger", href: "/ledger", icon: ReceiptText },
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
  { label: "Ledger", href: "/ledger", icon: ReceiptText },
  { label: "Transport", href: "/transport", icon: Bus },
  { label: "Students", href: "/students", icon: Users },
];

// The module behind each school page. The dashboard is open to everyone.
const NAV_MODULES: Record<string, PermissionModule> = {
  "/students": "students",
  "/teachers": "staff",
  "/classes": "classes",
  "/timetable": "timetable",
  "/attendance": "attendance",
  "/exams": "exams",
  "/fees": "fees",
  "/expenses": "expenses",
  "/ledger": "ledger",
  "/transport": "transport",
  "/assignments": "assignments",
  "/notices": "notices",
  "/analytics": "analytics",
};

/**
 * A teacher's or accountant's menu: their role's usual pages first, then any
 * other page the school admin opened to them, keeping only what they may see.
 */
function staffNavItems(base: typeof adminNavItems, permissions?: Permissions) {
  const extra = adminNavItems.filter(
    (item) => !base.some((b) => b.href === item.href),
  );
  return [...base, ...extra].filter((item) => {
    const pageModule = NAV_MODULES[item.href];
    if (!pageModule) return item.href === "/dashboard";
    return permissions ? can(permissions, pageModule) : base.includes(item);
  });
}

function getNavItems(role: UserRole, permissions?: Permissions) {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return superAdminNavItems;
    case UserRole.TEACHER:
      return staffNavItems(teacherNavItems, permissions);
    case UserRole.ACCOUNTANT:
      return staffNavItems(accountantNavItems, permissions);
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

// Colours and icons follow the tier; the label is the plan's current name.
function getPlanBadge(plan?: string, name?: string) {
  if (!plan) return null;
  const badge = planBadgeStyle(plan.toUpperCase());
  return { ...badge, label: name || badge.label };
}

function planBadgeStyle(plan: string) {
  switch (plan) {
    case "ENTERPRISE":
      return {
        label: "Enterprise",
        className:
          "bg-amber-500/15 text-amber-800 border-amber-300/60 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700/50",
        icon: Crown,
      };
    case "PRO":
      return {
        label: "PRO",
        className:
          "bg-violet-500/15 text-violet-700 border-violet-300/60 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-700/50",
        icon: Zap,
      };
    case "BASIC":
      return {
        label: "Basic",
        className:
          "bg-blue-500/15 text-blue-700 border-blue-300/60 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700/50",
        icon: Shield,
      };
    default:
      return {
        label: "Free",
        className:
          "bg-slate-500/15 text-slate-700 border-slate-300/60 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-700/50",
        icon: Sparkles,
      };
  }
}

export function Sidebar({
  userRole,
  permissions,
  schoolName,
  schoolPlan,
  planName,
}: Readonly<SidebarProps>) {
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  const isCollapsed = collapsed && isDesktop;
  const { open, setOpen } = useMobileNav();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const pathname = usePathname();
  const navItems = getNavItems(userRole, permissions);
  const roleBadge = getRoleBadge(userRole);
  const planBadge = getPlanBadge(schoolPlan, planName);

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden print:hidden"
        />
      )}
      <motion.aside
        id="app-sidebar"
        animate={{ width: isCollapsed ? 64 : isDesktop ? 240 : 272 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn(
          "flex flex-col h-screen bg-card border-r overflow-hidden flex-shrink-0 print:hidden",
          // Phones and tablets: a drawer over the page, hidden (not just moved) while shut.
          "fixed inset-y-0 left-0 z-50 transition-[transform,visibility] duration-200 lg:relative lg:z-auto lg:visible lg:translate-x-0",
          open
            ? "visible translate-x-0 shadow-xl"
            : "invisible -translate-x-full",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center h-14 px-4 border-b gap-3",
            isCollapsed && "justify-center",
          )}
        >
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <Image
              src="/kora-icon.png"
              alt="Kora"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
            />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-bold text-sm tracking-tight whitespace-nowrap"
              >
                Kora
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="ml-auto h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* School info */}
        {!isCollapsed && schoolName && (
          <div className="px-3 py-2.5 border-b">
            <div className="bg-muted/50 rounded-lg px-3 py-2 space-y-1.5">
              <p className="text-xs font-semibold truncate text-foreground">
                {schoolName}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    roleBadge.className,
                  )}
                >
                  {roleBadge.label}
                </span>
                {planBadge && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1 uppercase tracking-wider",
                      planBadge.className,
                    )}
                  >
                    <planBadge.icon className="w-2.5 h-2.5 fill-current" />
                    {planBadge.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav
          id="tour-sidebar-nav"
          className="flex-1 p-2 space-y-0.5 overflow-y-auto"
        >
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
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                  isActive
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center px-2",
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
                  {!isCollapsed && (
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
                {!isCollapsed && isLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600 dark:text-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop; the drawer has its own close button) */}
        <div className="p-2 border-t hidden lg:block">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
              isCollapsed && "justify-center px-2",
            )}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
