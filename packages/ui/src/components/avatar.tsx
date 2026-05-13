import * as React from "react";
import { getInitials, cn } from "@schoolos/utils";

const colors = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
];

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const colorIndex = name.charCodeAt(0) % colors.length;
  const sizeClass = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover", sizeClass, className)}
      />
    );
  }

  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold", colors[colorIndex], sizeClass, className)}>
      {getInitials(name)}
    </div>
  );
}
