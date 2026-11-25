"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  ImageIcon,
  Landmark,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import {
  deleteDocument,
  finishDocumentUpload,
  getDocumentLink,
  getEmployeeRecords,
  saveEmployeeDetails,
  startDocumentUpload,
} from "@/lib/actions/employee-records";
import {
  DOCUMENT_HINT,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_KEYS,
  DOCUMENT_TYPES,
  EMPTY_DETAILS,
  documentFileProblem,
  documentLabel,
  fileSize,
  formatAadhaar,
  maskAccount,
  maskAadhaar,
  type DocumentKind,
  type EmployeeDetails,
  type EmployeeDocumentRecord,
} from "@/lib/employee-details";

export interface EmployeeOwner {
  type: "teacher" | "staff";
  id: string;
}

const FIELDS: {
  key: Exclude<keyof EmployeeDetails, "updatedAt">;
  label: string;
  placeholder: string;
  secret?: (value: string) => string | null;
  upper?: boolean;
  inputMode?: "numeric" | "text";
}[] = [
  {
    key: "aadhaarNumber",
    label: "Aadhaar Number",
    placeholder: "12-digit Aadhaar number",
    secret: (v) => maskAadhaar(v.slice(-4)),
    inputMode: "numeric",
  },
  {
    key: "panNumber",
    label: "PAN Number",
    placeholder: "ABCDE1234F",
    upper: true,
  },
  {
    key: "uanNumber",
    label: "UAN (PF)",
    placeholder: "12-digit UAN",
    inputMode: "numeric",
  },
  {
    key: "bankAccountHolder",
    label: "Account Holder Name",
    placeholder: "As written in the bank",
  },
  {
    key: "bankName",
    label: "Bank Name",
    placeholder: "e.g. State Bank of India",
  },
  {
    key: "bankAccountNumber",
    label: "Bank Account Number",
    placeholder: "9 to 18 digits",
    secret: (v) => maskAccount(v.slice(-4)),
    inputMode: "numeric",
  },
  {
    key: "bankIfsc",
    label: "IFSC Code",
    placeholder: "SBIN0001234",
    upper: true,
  },
  { key: "upiId", label: "UPI ID", placeholder: "name@bank" },
];

type Form = Record<(typeof FIELDS)[number]["key"], string>;

const toForm = (d: EmployeeDetails): Form =>
  Object.fromEntries(FIELDS.map((f) => [f.key, d[f.key] ?? ""])) as Form;

/** Uploads to Cloudinary with progress; resolves to an error message or null. */
function sendFile(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(null);
      let message = "The upload didn't go through. Try again.";
      try {
        const reason = JSON.parse(xhr.responseText)?.error?.message;
        if (typeof reason === "string" && /format/i.test(reason)) {
          message = "Use a PDF, JPG, PNG or WebP file.";
        } else if (typeof reason === "string" && /size|large/i.test(reason)) {
          message = "A document can be up to 10 MB.";
        }
      } catch {
        // Not JSON; keep the general message.
      }
      resolve(message);
    };
    xhr.onerror = () =>
      resolve("We couldn't upload the file. Check your connection.");
    xhr.send(body);
  });
}

/**
 * A teacher's or staff member's ID and bank details, and their documents
 * (Aadhaar card, marksheets, certificates…). For Staff: manage.
 */
export function EmployeeRecords({
  owner,
  name,
}: Readonly<{ owner: EmployeeOwner; name: string }>) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [details, setDetails] = useState<EmployeeDetails>(EMPTY_DETAILS);
  const [documents, setDocuments] = useState<EmployeeDocumentRecord[]>([]);
  const [uploadsReady, setUploadsReady] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(toForm(EMPTY_DETAILS));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());

  const [kind, setKind] = useState<DocumentKind>("AADHAAR");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<EmployeeDocumentRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getEmployeeRecords(owner).catch(() => ({
      error: "Couldn't load the records. Try again.",
    }));
    if ("error" in res) {
      setLoadError(res.error);
    } else {
      setLoadError(null);
      setDetails(res.details);
      setDocuments(res.documents);
      setUploadsReady(res.uploadsReady);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.type, owner.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const res = await saveEmployeeDetails(owner, form);
    setSaving(false);
    if ("error" in res) {
      setFormError(res.error);
      return;
    }
    setDetails(res.details);
    setEditing(false);
    setShown(new Set());
    toast.success("ID and bank details saved");
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    const problem = documentFileProblem(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setProgress(0);
    try {
      const start = await startDocumentUpload(owner, {
        kind,
        title: title.trim() || undefined,
        fileName: file.name,
        size: file.size,
        type: file.type,
      });
      if ("error" in start) {
        setUploadError(start.error);
        return;
      }
      const failed = await sendFile(
        start.uploadUrl,
        start.fields,
        file,
        setProgress,
      );
      // Finishing also clears away an upload that didn't arrive.
      const done = await finishDocumentUpload(start.documentId);
      if (failed || "error" in done) {
        setUploadError(failed ?? ("error" in done ? done.error : null));
        return;
      }
      setDocuments((list) => [done.document, ...list]);
      setTitle("");
      toast.success(`${documentLabel(done.document)} added`);
    } catch {
      setUploadError("We couldn't upload the file. Try again.");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const open = async (doc: EmployeeDocumentRecord) => {
    // Opened now, while the click still counts, so it isn't blocked.
    const tab = window.open("about:blank", "_blank");
    setOpening(doc.id);
    const res = await getDocumentLink(doc.id);
    setOpening(null);
    if ("error" in res) {
      tab?.close();
      toast.error(res.error);
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = res.url;
    } else {
      window.location.assign(res.url);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await deleteDocument(toDelete.id);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setDocuments((list) => list.filter((d) => d.id !== toDelete.id));
    toast.success(`${documentLabel(toDelete)} deleted`);
    setToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading documents and
        details…
      </div>
    );
  }
  if (loadError) {
    return (
      <div role="alert" className="rounded-xl border p-6 text-center text-sm">
        <p className="text-destructive">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 h-8 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }

  const busy = progress !== null;

  return (
    <div className="space-y-5">
      {/* ID and bank details */}
      <section
        className="rounded-xl border bg-card p-5"
        aria-labelledby="ids-heading"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3
            id="ids-heading"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <Landmark className="h-4 w-4" /> ID &amp; bank details
          </h3>
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setForm(toForm(details));
                setFormError(null);
                setEditing(true);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <FormField key={f.key} label={f.label} htmlFor={`emp-${f.key}`}>
                  <input
                    id={`emp-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [f.key]: f.upper
                          ? e.target.value.toUpperCase()
                          : e.target.value,
                      }))
                    }
                    inputMode={f.inputMode}
                    autoComplete="off"
                    placeholder={f.placeholder}
                    className={`${inputCls} ${f.upper ? "uppercase" : ""}`}
                  />
                </FormField>
              ))}
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Aadhaar and account numbers are stored encrypted, and are shown
              only to people who can manage staff.
            </p>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 rounded-lg border px-4 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save details
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {FIELDS.map((f) => {
              const value = details[f.key];
              const isShown = shown.has(f.key);
              const text =
                value && f.secret && !isShown
                  ? f.secret(value)
                  : value && f.key === "aadhaarNumber"
                    ? formatAadhaar(value)
                    : value;
              return (
                <div key={f.key} className="min-w-0">
                  <dt className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="flex items-center gap-2 text-sm font-medium">
                    {value ? (
                      <span className="break-all font-mono">{text}</span>
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        Not added
                      </span>
                    )}
                    {value && f.secret && (
                      <button
                        type="button"
                        onClick={() =>
                          setShown((s) => {
                            const next = new Set(s);
                            if (next.has(f.key)) next.delete(f.key);
                            else next.add(f.key);
                            return next;
                          })
                        }
                        aria-label={`${isShown ? "Hide" : "Show"} ${f.label}`}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {isShown ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>

      {/* Documents */}
      <section
        className="rounded-xl border bg-card p-5"
        aria-labelledby="docs-heading"
      >
        <h3
          id="docs-heading"
          className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <FileText className="h-4 w-4" /> Documents
          {documents.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] normal-case">
              {documents.length}
            </span>
          )}
        </h3>

        {uploadsReady ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <FormField label="Type of document" htmlFor="doc-kind">
                <select
                  id="doc-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as DocumentKind)}
                  disabled={busy}
                  className={selectCls}
                >
                  {DOCUMENT_KIND_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {DOCUMENT_KINDS[k]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Name (optional)" htmlFor="doc-title">
                <input
                  id="doc-title"
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Class 12, B.Ed, front side"
                  className={inputCls}
                />
              </FormField>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={Object.keys(DOCUMENT_TYPES).join(",")}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  data-testid="document-input"
                  onChange={(e) => void upload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {busy ? `Uploading ${progress}%` : "Upload file"}
                </button>
              </div>
            </div>
            {busy && (
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progress ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div
                  className="h-full bg-violet-600 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <p
              role={uploadError ? "alert" : undefined}
              className={`mt-2 text-xs ${uploadError ? "text-destructive" : "text-muted-foreground"}`}
            >
              {uploadError ??
                `${DOCUMENT_HINT} Files are private to your school.`}
            </p>
          </div>
        ) : (
          <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Document uploads aren&apos;t set up on this server yet.
          </p>
        )}

        {documents.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No documents for {name} yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                  {doc.format === "pdf" ? (
                    <FileText className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {documentLabel(doc)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.fileName}
                    {doc.bytes ? ` · ${fileSize(doc.bytes)}` : ""} · Added by{" "}
                    {doc.uploadedByName} on{" "}
                    {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void open(doc)}
                  disabled={opening === doc.id}
                  className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                >
                  {opening === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(doc)}
                  aria-label={`Delete ${documentLabel(doc)}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete document"
        description={
          toDelete
            ? `Delete ${documentLabel(toDelete)} (${toDelete.fileName})? The file is removed for good.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={remove}
      />
    </div>
  );
}

/** The records in a dialog, for staff members (who have no profile page). */
export function EmployeeRecordsDialog({
  owner,
  name,
  open,
  onOpenChange,
}: Readonly<{
  owner: EmployeeOwner | null;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Documents & IDs: ${name}`}
      description="ID numbers, bank details for salary, and documents like Aadhaar, marksheets and certificates."
      className="max-w-3xl"
    >
      {owner && <EmployeeRecords owner={owner} name={name} />}
    </Dialog>
  );
}
