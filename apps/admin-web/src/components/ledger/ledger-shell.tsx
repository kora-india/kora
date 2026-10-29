"use client";

import React from "react";
import Link from "next/link";
import { History, ReceiptText } from "lucide-react";
import { ConfigProvider, theme as antTheme } from "antd";
import { useTheme } from "next-themes";
import { useBrandHex } from "@/components/layout/brand";

const DESCRIPTIONS = {
  transactions:
    "Every fee collected and every expense paid, with who recorded it.",
  activity:
    "Everything people do in the app: sign-ins and every change they save.",
};

/**
 * The ledger's title, its Transactions / Activity tabs (admins only see
 * Activity), and the antd theme its filters use.
 */
export function LedgerShell({
  tab,
  showTabs,
  actions,
  children,
}: Readonly<{
  tab: "transactions" | "activity";
  showTabs: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}>) {
  const { resolvedTheme } = useTheme();
  const brandColor = useBrandHex();
  const isDark = resolvedTheme === "dark";

  const tabs = [
    {
      id: "transactions",
      label: "Transactions",
      href: "/ledger",
      icon: ReceiptText,
    },
    {
      id: "activity",
      label: "Activity",
      href: "/ledger?tab=activity",
      icon: History,
    },
  ] as const;

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: brandColor,
          borderRadius: 10,
          colorBgContainer: isDark ? "#09090b" : "#ffffff",
          colorBgElevated: isDark ? "#18181b" : "#ffffff",
          colorBorder: isDark ? "#27272a" : "#e4e4e7",
          colorBorderSecondary: isDark ? "#27272a" : "#f4f4f5",
          colorText: isDark ? "#f4f4f5" : "#09090b",
          colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
        },
      }}
    >
      <div className="flex-1 space-y-5 p-4 md:p-8 pt-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {DESCRIPTIONS[tab]}
            </p>
          </div>
          {actions}
        </div>

        {showTabs && (
          <nav className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit border print:hidden">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  tab === t.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </Link>
            ))}
          </nav>
        )}

        {children}
      </div>
    </ConfigProvider>
  );
}
