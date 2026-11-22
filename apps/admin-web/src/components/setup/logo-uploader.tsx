"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@schoolos/utils";
import { LOGO_HINT, LOGO_TYPES, uploadLogo } from "@/lib/logo-upload";
import { messageId } from "./setup-fields";

export { LOGO_MAX_BYTES, LOGO_TYPES, logoFileProblem } from "@/lib/logo-upload";

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
    setError(null);
    setIsUploading(true);
    try {
      const result = await uploadLogo(file);
      if ("url" in result) onChange(result.url);
      else setError(result.error);
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
          {error ?? `${LOGO_HINT} You can also drop it here.`}
        </p>
      </div>
    </div>
  );
}
