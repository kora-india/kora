"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@schoolos/utils";
import { messageId } from "./setup-fields";

export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Why a file can't be used as the logo, or null when it can. */
export function logoFileProblem(file: File) {
  if (!LOGO_TYPES.includes(file.type)) return "Use a PNG, JPG or WebP image.";
  if (file.size > LOGO_MAX_BYTES) return "The logo can be up to 5 MB.";
  return null;
}

export function LogoUploader({
  value,
  onChange,
}: Readonly<{ value?: string; onChange: (url: string) => void }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = logoFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) onChange(data.url);
      else setError(data.error || "We couldn't upload the logo. Try again.");
    } catch {
      setError("We couldn't upload the logo. Check your connection.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        upload(e.dataTransfer.files?.[0]);
      }}
      className="flex items-center gap-4"
    >
      <div
        className={cn(
          "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 transition-colors",
          !value && "border-dashed",
          isDragging && "border-violet-500 bg-violet-50 dark:bg-violet-900/30",
        )}
      >
        {isUploading ? (
          <Loader2
            className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400"
            aria-label="Uploading logo"
          />
        ) : value ? (
          <img
            src={value}
            alt="School logo"
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="flex items-baseline gap-2 text-sm font-medium">
          School logo
          <span className="text-xs font-normal text-muted-foreground">
            Optional
          </span>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="logo-input"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            aria-describedby={messageId("logo")}
            className="inline-flex h-8 items-center rounded-lg border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : value ? "Replace" : "Upload logo"}
          </button>
          {value && !isUploading && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remove
            </button>
          )}
        </div>
        <p
          id={messageId("logo")}
          className={cn(
            "text-xs",
            error
              ? "text-destructive dark:text-red-400"
              : "text-muted-foreground",
          )}
        >
          {error ?? "PNG, JPG or WebP, up to 5 MB. You can also drop it here."}
        </p>
      </div>
    </div>
  );
}
