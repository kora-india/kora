"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@schoolos/utils";
import { LOGO_HINT, LOGO_TYPES, uploadLogo } from "@/lib/logo-upload";
import { updateSchoolLogo } from "@/lib/actions/settings";

interface Props {
  schoolName: string;
  logoUrl: string | null;
  canEdit: boolean;
}

/** The logo tile on the School Profile card, with Change and Remove. */
export function SchoolLogoEditor({
  schoolName,
  logoUrl,
  canEdit,
}: Readonly<Props>) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown at once, before the page refreshes with the saved one.
  const [shown, setShown] = useState(logoUrl);

  const save = async (url: string | null) => {
    const result = await updateSchoolLogo(url);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setShown(url);
    toast.success(url ? "School logo updated" : "School logo removed");
    router.refresh();
    return true;
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("upload");
    try {
      const result = await uploadLogo(file);
      if ("error" in result) setError(result.error);
      else await save(result.url);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setError(null);
    setBusy("remove");
    try {
      await save(null);
    } finally {
      setBusy(null);
    }
  };

  const tile = (
    <>
      {busy === "upload" ? (
        <Loader2
          className="h-7 w-7 animate-spin text-violet-600 dark:text-violet-300"
          aria-label="Uploading logo"
        />
      ) : shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded logo on Cloudinary
        <img
          src={shown}
          alt={`${schoolName} logo`}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        <BookOpen
          className="h-9 w-9 text-violet-600 dark:text-violet-300"
          aria-hidden
        />
      )}
    </>
  );

  const tileCls =
    "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-violet-50 dark:bg-violet-950/40";

  if (!canEdit) return <div className={tileCls}>{tile}</div>;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="profile-logo-input"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy !== null}
        title={`${shown ? "Change logo" : "Upload logo"} (${LOGO_HINT})`}
        className={cn(
          tileCls,
          "group cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait",
          !shown && "border-dashed",
        )}
      >
        <span className="sr-only">{shown ? "Change logo" : "Upload logo"}</span>
        {tile}
        {busy === null && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <Camera className="h-3 w-3" />
            {shown ? "Change" : "Upload"}
          </span>
        )}
      </button>
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
          className="font-medium text-violet-700 hover:underline disabled:opacity-50 dark:text-violet-300"
        >
          {busy === "upload"
            ? "Uploading…"
            : shown
              ? "Change logo"
              : "Upload logo"}
        </button>
        {shown && (
          <>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              {busy === "remove" ? "Removing…" : "Remove"}
            </button>
          </>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="max-w-[10rem] text-center text-[11px] leading-snug text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
