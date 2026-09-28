"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@schoolos/utils";
import { inputCls } from "@/components/ui/form-field";
import {
  MAX_SECTIONS,
  SECTION_NAME_MAX,
  nameKey,
  normalizeName,
  validateSectionName,
} from "@/lib/class-catalog";
import { useEscapeInterceptor } from "./option-picker";

const PRESETS: string[][] = [
  ["A"],
  ["A", "B"],
  ["A", "B", "C"],
  ["A", "B", "C", "D"],
];

export function SectionChip({
  name,
  onRemove,
}: Readonly<{ name: string; onRemove: () => void }>) {
  return (
    <span className="inline-flex items-center gap-1 max-w-full h-8 pl-3 pr-1 rounded-lg text-sm font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800">
      <span className="truncate" title={name}>
        {name}
      </span>
      <button
        type="button"
        aria-label={`Remove section ${name}`}
        onClick={onRemove}
        className="w-6 h-6 rounded-md flex items-center justify-center text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-800 hover:text-violet-700 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

interface SectionInputProps {
  value: string[];
  onChange: (sections: string[]) => void;
  labelId?: string;
}

export function SectionInput({
  value,
  onChange,
  labelId,
}: Readonly<SectionInputProps>) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const cancel = () => {
    setAdding(false);
    setDraft("");
    setError(null);
    requestAnimationFrame(() => addBtnRef.current?.focus());
  };

  useEscapeInterceptor(adding, cancel);

  const commit = () => {
    // Allow pasting "A, B, C" as a convenience.
    const parts = draft.split(",").map(normalizeName).filter(Boolean);
    if (parts.length === 0) {
      setError("Section name can't be empty");
      return;
    }
    const next = [...value];
    const seen = new Set(value.map(nameKey));
    for (const part of parts) {
      const invalid = validateSectionName(part);
      if (invalid) {
        setError(parts.length > 1 ? `"${part}": ${invalid}` : invalid);
        return;
      }
      if (seen.has(nameKey(part))) {
        setError(`Section "${part}" is already added`);
        return;
      }
      seen.add(nameKey(part));
      next.push(part);
    }
    if (next.length > MAX_SECTIONS) {
      setError(`A class can have at most ${MAX_SECTIONS} sections`);
      return;
    }
    onChange(next);
    setDraft("");
    setError(null);
    inputRef.current?.focus();
  };

  const presetKey = (p: string[]) => p.join("|").toLowerCase();
  const currentKey = presetKey(value);

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-2"
      >
        {value.map((s) => (
          <SectionChip
            key={nameKey(s)}
            name={s}
            onRemove={() => onChange(value.filter((v) => v !== s))}
          />
        ))}
        {!adding && value.length < MAX_SECTIONS && (
          <button
            ref={addBtnRef}
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add section
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <label
            htmlFor="new-section-name"
            className="text-xs font-medium block"
          >
            Section name
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="new-section-name"
              ref={inputRef}
              value={draft}
              maxLength={SECTION_NAME_MAX * 4}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              aria-invalid={!!error || undefined}
              aria-describedby="new-section-help"
              placeholder="e.g. D, Blue, Morning, Science"
              className={cn(inputCls, "h-10", error && "border-red-400")}
            />
            <div className="flex gap-2 justify-end flex-shrink-0">
              <button
                type="button"
                onClick={cancel}
                className="h-10 px-3 border rounded-lg text-sm bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commit}
                className="h-10 px-3 rounded-lg text-sm font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:hover:bg-violet-900/60 transition-colors"
              >
                Add section
              </button>
            </div>
          </div>
          <p
            id="new-section-help"
            className={cn(
              "text-xs",
              error ? "text-red-500" : "text-muted-foreground",
            )}
          >
            {error ??
              "Press Enter to add. Paste “A, B, C” to add several at once."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Quick add:</span>
        {PRESETS.map((preset) => {
          const isActive = presetKey(preset) === currentKey;
          return (
            <button
              key={preset.join("+")}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(preset)}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium border transition-colors",
                isActive
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-background hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-300",
              )}
            >
              {preset.join(" + ")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
