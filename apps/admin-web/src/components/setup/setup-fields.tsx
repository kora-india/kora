"use client";

import { forwardRef } from "react";
import { Check, CircleAlert } from "lucide-react";
import { cn } from "@schoolos/utils";

export function SetupSection({
  title,
  description,
  action,
  children,
}: Readonly<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}>) {
  const headingId = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border bg-card text-card-foreground"
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 id={headingId} className="text-sm font-semibold">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

export const messageId = (id: string) => `${id}-message`;

/** aria props for a control whose label and message come from `Field`. */
export function fieldProps(
  id: string,
  error?: string,
  hasMessage = Boolean(error),
) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": hasMessage || error ? messageId(id) : undefined,
  } as const;
}

export function FieldMessage({
  id,
  hint,
  error,
}: Readonly<{ id: string; hint?: React.ReactNode; error?: string }>) {
  if (error) {
    return (
      <p
        id={messageId(id)}
        className="flex items-center gap-1.5 text-xs text-destructive dark:text-red-400"
      >
        <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <div id={messageId(id)} className="text-xs text-muted-foreground">
      {hint}
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: Readonly<{
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-sm font-medium"
      >
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">
            Optional
          </span>
        )}
      </label>
      {children}
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  );
}

/** A labelled group of radios or checkboxes. */
export function ChoiceGroup({
  id,
  legend,
  hint,
  error,
  action,
  className,
  children,
}: Readonly<{
  id: string;
  legend: string;
  hint?: React.ReactNode;
  error?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}>) {
  // A named group rather than fieldset/legend, whose legend rendering can't
  // share a row with the action.
  const labelId = `${id}-label`;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint || error ? messageId(id) : undefined}
      aria-invalid={error ? true : undefined}
      className={cn("space-y-2.5", className)}
    >
      <div className="flex items-center justify-between gap-4">
        <span id={labelId} className="text-sm font-medium">
          {legend}
        </span>
        {action}
      </div>
      {children}
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  );
}

export const primaryButtonCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export const inputCls =
  "w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/30";

/** An input with a fixed prefix or suffix ("+91", ".schoolos.com"). */
export const InputGroup = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    prefix?: string;
    suffix?: string;
  }
>(function InputGroup({ prefix, suffix, className, ...props }, ref) {
  const addon =
    "flex items-center bg-muted/60 px-3 text-sm text-muted-foreground select-none";
  return (
    <div
      className={cn(
        "flex h-10 overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-transparent focus-within:ring-2 focus-within:ring-ring has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:focus-within:ring-destructive/30",
        className,
      )}
    >
      {prefix && (
        <span className={cn(addon, "border-r")} aria-hidden>
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        {...props}
      />
      {suffix && (
        <span className={cn(addon, "border-l")} aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  );
});

// Selected and focused states read from the native input inside the label,
// in the sidebar's active-item colours.
const selectedCls =
  "has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50 has-[:checked]:text-violet-700 dark:has-[:checked]:border-violet-500/70 dark:has-[:checked]:bg-violet-900/30 dark:has-[:checked]:text-violet-300";
const focusCls =
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background";

type NativeChoiceProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & { type?: "radio" | "checkbox" };

/** A radio or checkbox drawn as a card with an optional icon and detail. */
export const ChoiceCard = forwardRef<
  HTMLInputElement,
  NativeChoiceProps & {
    label: string;
    detail?: string;
    icon?: React.ComponentType<{ className?: string }>;
    layout?: "row" | "stack";
  }
>(function ChoiceCard(
  {
    label,
    detail,
    icon: Icon,
    layout = "row",
    type = "radio",
    className,
    ...props
  },
  ref,
) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer rounded-lg border bg-background p-3 text-foreground transition-colors hover:bg-muted/60",
        layout === "stack"
          ? "flex-col items-center gap-2 py-4 text-center"
          : "items-start gap-3",
        selectedCls,
        focusCls,
        className,
      )}
    >
      <input ref={ref} type={type} className="sr-only" {...props} />
      {Icon && (
        <Icon
          className={cn(
            "shrink-0 text-muted-foreground transition-colors group-has-[:checked]:text-violet-600 dark:group-has-[:checked]:text-violet-400",
            layout === "stack" ? "h-6 w-6" : "mt-0.5 h-4 w-4",
          )}
        />
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      {layout === "row" && (
        <span
          aria-hidden
          className="ml-auto mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-input bg-background transition-colors group-has-[:checked]:border-violet-600 group-has-[:checked]:bg-violet-600 dark:group-has-[:checked]:border-violet-400 dark:group-has-[:checked]:bg-violet-400"
        >
          <Check className="hidden h-2.5 w-2.5 text-white group-has-[:checked]:block dark:text-zinc-950" />
        </span>
      )}
    </label>
  );
});

/** A compact toggle for multi-select lists (classes, working days). */
export const Chip = forwardRef<
  HTMLInputElement,
  NativeChoiceProps & { label: string; srLabel?: string }
>(function Chip(
  { label, srLabel, type = "checkbox", className, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        "group inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
        selectedCls,
        "has-[:checked]:font-medium",
        focusCls,
        className,
      )}
    >
      <input
        ref={ref}
        type={type}
        className="sr-only"
        aria-label={srLabel}
        {...props}
      />
      <Check
        aria-hidden
        className="-ml-0.5 hidden h-3.5 w-3.5 shrink-0 group-has-[:checked]:block"
      />
      {label}
    </label>
  );
});
