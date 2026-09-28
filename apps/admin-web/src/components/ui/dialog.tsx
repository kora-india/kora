"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@schoolos/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  zIndex?: number;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  className,
  zIndex,
}: DialogProps) {
  const overlayStyle = zIndex ? { zIndex } : undefined;
  const contentStyle = zIndex ? { zIndex: zIndex + 1 } : undefined;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          style={overlayStyle}
          className={cn(
            "fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            !zIndex && "z-50",
          )}
        />
        <RadixDialog.Content
          style={contentStyle}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            !zIndex && "z-50",
            "w-full max-w-lg max-h-[90vh] overflow-y-auto",
            "rounded-2xl border bg-card shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2",
            className,
          )}
        >
          <div className="flex items-center justify-between gap-3 p-5 border-b">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <RadixDialog.Title className="text-base font-semibold">
                  {title}
                </RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="text-xs text-muted-foreground mt-0.5">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="rounded-lg p-1.5 hover:bg-muted transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </RadixDialog.Close>
          </div>
          <div className="p-5">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
