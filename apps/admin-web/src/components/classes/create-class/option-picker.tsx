"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@schoolos/utils";

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  badge?: string;
  /** Extra text matched by the search box. */
  keywords?: string;
}

export interface PickerGroup {
  label?: string;
  options: PickerOption[];
}

interface OptionPickerProps {
  groups: PickerGroup[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Icon shown inside the trigger before the selected label. */
  triggerIcon?: React.ReactNode;
  invalid?: boolean;
  id?: string;
  "aria-labelledby"?: string;
  /** Rendered as a sticky row below the list (e.g. a create action). */
  footer?: (close: () => void) => React.ReactNode;
}

/**
 * Closes on Escape without letting the surrounding Radix dialog see the key.
 * Radix listens on `document` in the capture phase, so we intercept on
 * `window`, which runs first.
 */
export function useEscapeInterceptor(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      handler.current();
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [active]);
}

export function OptionPicker({
  groups,
  value,
  onChange,
  placeholder,
  searchable,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  triggerIcon,
  invalid,
  id,
  footer,
  ...aria
}: Readonly<OptionPickerProps>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Browsers fire synthetic mousemove when the list scrolls under a still
  // cursor; only let real pointer movement steal the keyboard highlight.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) =>
          `${o.label} ${o.keywords ?? ""} ${g.label ?? ""}`
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => filtered.flatMap((g) => g.options), [filtered]);
  const selected = useMemo(
    () => groups.flatMap((g) => g.options).find((o) => o.value === value),
    [groups, value],
  );

  const close = (refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  };

  const openMenu = () => {
    const idx = flat.findIndex((o) => o.value === value);
    setActive(Math.max(0, idx));
    lastPointer.current = null;
    setOpen(true);
  };

  useEscapeInterceptor(open, () => close());

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => setActive(0), [query]);

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (opt: PickerOption) => {
    onChange(opt.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(flat.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  let index = -1;
  const activeId = flat[active] ? `${listId}-${active}` : undefined;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-labelledby={aria["aria-labelledby"]}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          "w-full h-10 px-3 rounded-lg border bg-background text-sm flex items-center gap-2 text-left transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:border-transparent",
          open && "ring-2 ring-violet-500 border-transparent",
          invalid && !open && "border-red-400",
        )}
      >
        {(selected?.icon ?? triggerIcon) && (
          <span className="flex-shrink-0 text-muted-foreground">
            {selected?.icon ?? triggerIcon}
          </span>
        )}
        <span
          className={cn(
            "flex-1 truncate",
            !selected && "text-muted-foreground",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95"
          onKeyDown={onKeyDown}
        >
          {searchable && (
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  className="w-full h-9 pl-8 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={searchable ? undefined : activeId}
            className="max-h-[min(18rem,45vh)] overflow-y-auto overscroll-contain p-1.5 focus:outline-none"
          >
            {flat.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyText}
              </p>
            )}
            {filtered.map((group, gi) => (
              <div
                key={group.label ?? gi}
                role="group"
                aria-label={group.label}
                className={cn(gi > 0 && "mt-1 pt-1 border-t")}
              >
                {group.label && (
                  <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {group.options.map((opt) => {
                  index += 1;
                  const i = index;
                  const isSelected = opt.value === value;
                  return (
                    <div
                      key={opt.value}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={(e) => {
                        const last = lastPointer.current;
                        lastPointer.current = { x: e.clientX, y: e.clientY };
                        if (
                          !last ||
                          (last.x === e.clientX && last.y === e.clientY)
                        )
                          return;
                        setActive(i);
                      }}
                      onClick={() => choose(opt)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer select-none",
                        i === active && "bg-muted",
                        isSelected &&
                          "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
                      )}
                    >
                      {opt.icon && (
                        <span className="flex-shrink-0">{opt.icon}</span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">
                          {opt.label}
                        </span>
                        {opt.hint && (
                          <span className="block truncate text-xs text-muted-foreground font-normal">
                            {opt.hint}
                          </span>
                        )}
                      </span>
                      {opt.badge && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground flex-shrink-0">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 flex-shrink-0 text-violet-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {footer && <div className="border-t p-1.5">{footer(close)}</div>}
        </div>
      )}
    </div>
  );
}
