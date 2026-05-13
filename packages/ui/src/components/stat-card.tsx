import * as React from "react";
import { cn } from "@schoolos/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  colorClass?: string;
  className?: string;
}

export function StatCard({ title, value, icon, trend, colorClass = "text-primary", className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className={cn("text-2xl font-bold tracking-tight", colorClass)}>{value}</p>
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
        )}
      </div>
      {trend && (
        <div className={cn(
          "mt-3 flex items-center gap-1 text-xs font-medium",
          trend.direction === "up" ? "text-green-600 dark:text-green-400" :
          trend.direction === "down" ? "text-red-600 dark:text-red-400" :
          "text-muted-foreground"
        )}>
          {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
          {trend.value}
        </div>
      )}
    </div>
  );
}
