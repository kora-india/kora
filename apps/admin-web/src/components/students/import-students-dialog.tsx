"use client";

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from "lucide-react";
import { read, utils } from "xlsx";
import { toast } from "sonner";
import { bulkImportStudents } from "@/lib/actions/student-import";
import { suggestImportMapping } from "@/lib/actions/import-mapping";
import {
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  applySuggestions,
  classMatchKey,
  describeColumn,
  guessColumnMapping,
  isImportField,
  missingImportColumns,
  normalizeImportRow,
  type ColumnMapping,
} from "@/lib/student-import-helpers";

/** A spreadsheet row as read, with its line in the sheet. */
type SheetRow = { cells: Record<string, unknown>; sheetRow: number };

/** SheetJS names columns without a header "__EMPTY", "__EMPTY_1", … */
const columnLabel = (header: string) =>
  header.startsWith("__EMPTY") ? "(no header)" : header;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: {
    id: string;
    name: string;
    sections: { id: string; name: string }[];
  }[];
}

export function ImportStudentsDialog({
  open,
  onOpenChange,
  classes,
}: Readonly<Props>) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  // The field each column fills: the header rules' guess, then Gemini's
  // suggestions for the rest, then whatever the person picks.
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [aiSuggested, setAiSuggested] = useState<Set<string>>(new Set());
  const [aiStatus, setAiStatus] = useState<
    "idle" | "matching" | "done" | "failed"
  >("idle");
  const [aiMessage, setAiMessage] = useState("");
  // Columns the person set by hand; a late suggestion never changes them.
  const touched = useRef(new Set<string>());
  // Only the latest file's suggestions count.
  const fileVersion = useRef(0);
  // The mapping as last rendered, for suggestions that arrive later.
  const mappingRef = useRef(mapping);
  mappingRef.current = mapping;
  const [loading, setLoading] = useState(false);
  const [globalClassId, setGlobalClassId] = useState("");
  const [globalSectionId, setGlobalSectionId] = useState("");

  const [report, setReport] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    // A CSV is read as UTF-8 text, so Hindi names and headers arrive as
    // written; read as bytes they turned into "à¤à¤¾…". Excel files are
    // read as bytes, which SheetJS decodes itself.
    const isText =
      /\.(csv|tsv|txt)$/i.test(file.name) || file.type.startsWith("text/");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        // raw: keep CSV cells as typed, so "05/06/2010" isn't reread as a
        // US month-first date before the server parses it as DD/MM/YYYY (D5).
        // Excel date cells still arrive as serial numbers, which the server
        // converts.
        const workbook = isText
          ? read(data as string, { type: "string", raw: true })
          : read(data, { type: "array", raw: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { defval: "" },
        );
        // Every row has every column (defval), so the first row's keys are
        // the headers, duplicates made unique by SheetJS ("Name_1").
        const fileHeaders = Object.keys(rawData[0] ?? {});
        const rows = rawData
          .map((cells, index) => ({
            cells,
            // SheetJS keeps each row's 0-based line; the header is line 1.
            sheetRow:
              typeof (cells as { __rowNum__?: unknown }).__rowNum__ === "number"
                ? (cells as { __rowNum__: number }).__rowNum__ + 1
                : index + 2,
          }))
          // Leave out rows with nothing in them.
          .filter(({ cells }) =>
            Object.values(cells).some((v) => String(v ?? "").trim() !== ""),
          );

        const guessed = guessColumnMapping(fileHeaders);
        touched.current = new Set();
        setHeaders(fileHeaders);
        setSheetRows(rows);
        setMapping(guessed);
        setAiSuggested(new Set());
        setStep(2);
        void suggestColumns(fileHeaders, rows, guessed);
      } catch (err) {
        toast.error("Failed to parse file. Please check the format.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    if (isText) reader.readAsText(file, "utf-8");
    else reader.readAsArrayBuffer(file);
  };

  /**
   * Asks Gemini about the columns the rules couldn't place. It's shown each
   * header and a description of its values (describeColumn), never the
   * values. Suggestions fill only columns still unmatched and untouched.
   */
  const suggestColumns = async (
    fileHeaders: string[],
    rows: SheetRow[],
    guessed: ColumnMapping,
  ) => {
    const version = ++fileVersion.current;
    const unmatched = fileHeaders.filter((h) => !guessed[h]);
    if (unmatched.length === 0) {
      setAiStatus("idle");
      return;
    }
    setAiStatus("matching");
    setAiMessage("");
    const res = await suggestImportMapping({
      columns: unmatched.map((header) => ({
        header: columnLabel(header),
        description: describeColumn(rows.map((r) => r.cells[header])),
      })),
      taken: Object.values(guessed).filter(isImportField),
    }).catch(() => ({ error: "AI couldn't match the columns right now." }));
    if (version !== fileVersion.current) return;

    if ("suggestions" in res) {
      // Gemini answers by the label it was shown; map back to the column.
      const byHeader: ColumnMapping = {};
      for (const header of unmatched) {
        const field = res.suggestions[columnLabel(header)];
        if (field) byHeader[header] = field;
      }
      const applied = applySuggestions(
        mappingRef.current,
        byHeader,
        touched.current,
      );
      setMapping(applied.mapping);
      setAiSuggested(new Set(applied.suggested));
      setAiStatus("done");
    } else {
      setAiStatus("failed");
      setAiMessage("error" in res ? res.error : "");
    }
  };

  const setColumnField = (header: string, value: string) => {
    touched.current.add(header);
    setAiSuggested((s) => {
      const next = new Set(s);
      next.delete(header);
      return next;
    });
    setMapping((m) => ({
      ...m,
      [header]: isImportField(value) ? value : null,
    }));
  };

  const parsedData = useMemo(
    () =>
      sheetRows.map(({ cells, sheetRow }) => ({
        ...normalizeImportRow(cells, mapping),
        sheetRow,
      })),
    [sheetRows, mapping],
  );
  const missingColumns = missingImportColumns(mapping);
  // The first filled cell of each column, to help pick its field. It stays
  // in the browser.
  const examples = useMemo(() => {
    const found: Record<string, string> = {};
    for (const header of headers) {
      const row = sheetRows.find(
        (r) => String(r.cells[header] ?? "").trim() !== "",
      );
      if (row) found[header] = String(row.cells[header]).trim();
    }
    return found;
  }, [headers, sheetRows]);

  const handleImport = async () => {
    setLoading(true);
    // Rows without a class or section take the ones picked for the file.
    // A class the school doesn't have yet goes by name; the server adds it.
    const finalData = parsedData.map(
      ({ class: className, section, ...row }) => {
        let classId = globalClassId;
        if (className) {
          const matched = classes.find(
            (c) => classMatchKey(c.name) === classMatchKey(className),
          );
          classId = matched ? matched.id : className;
        }

        let sectionId = globalSectionId;
        if (section) {
          const matched = classes
            .find((c) => c.id === classId)
            ?.sections.find(
              (s) => s.name.toLowerCase() === section.toLowerCase(),
            );
          sectionId = matched ? matched.id : section;
        }

        return { ...row, classId, sectionId };
      },
    );

    try {
      const res = await bulkImportStudents(finalData);
      setReport({
        imported: res.imported,
        skipped: res.skipped,
        failed: res.failed,
        errors: res.errors || [],
      });
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const hasMissingClassData = parsedData.some(
    (row) => !row.class || !row.section,
  );
  const selectedClassObj = classes.find((c) => c.id === globalClassId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] bg-card border rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold">Bulk Import Students</h2>
            <p className="text-sm text-muted-foreground">
              Upload CSV or Excel file to add students
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div
                  className="w-full max-w-lg p-12 border-2 border-dashed rounded-xl flex flex-col items-center text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-full flex items-center justify-center mb-4">
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-8 h-8" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Select a file to upload
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Support for .csv, .xls, .xlsx. Write dates of birth as
                    DD/MM/YYYY.
                  </p>
                  <button className="h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                    Browse Files
                  </button>
                  <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {missingColumns.length > 0 && (
                  <div
                    role="alert"
                    className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-800 dark:text-red-400">
                        Choose a column for{" "}
                        {missingColumns.join(", ").toLowerCase()}
                      </h4>
                      <p className="text-xs text-red-700 dark:text-red-500 mt-1">
                        Every student needs a name, a parent&apos;s name and a
                        parent&apos;s phone. Pick the column that holds each in
                        the list below.
                      </p>
                    </div>
                  </div>
                )}

                <section aria-labelledby="import-columns-heading">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 id="import-columns-heading" className="font-semibold">
                      Columns in your file
                    </h3>
                    <p
                      aria-live="polite"
                      className="text-xs text-muted-foreground flex items-center gap-1.5"
                    >
                      {aiStatus === "matching" && (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Asking AI to match the columns we didn&apos;t
                          recognise…
                        </>
                      )}
                      {aiStatus === "done" && aiSuggested.size > 0 && (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                          AI matched {aiSuggested.size} column
                          {aiSuggested.size === 1 ? "" : "s"}. Check them before
                          importing.
                        </>
                      )}
                      {aiStatus === "failed" && aiMessage}
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {headers.map((header) => {
                      const label = columnLabel(header);
                      return (
                        <div
                          key={header}
                          className="flex items-center gap-3 border rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {label}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {examples[header] || "Empty"}
                            </p>
                          </div>
                          {aiSuggested.has(header) && (
                            <span
                              title="Suggested by AI"
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                            >
                              <Sparkles className="w-3 h-3" />
                              AI
                            </span>
                          )}
                          <select
                            aria-label={`Field for column "${label}"`}
                            value={mapping[header] ?? ""}
                            onChange={(e) =>
                              setColumnField(header, e.target.value)
                            }
                            className={`h-9 w-40 px-2 rounded-lg border bg-background text-sm ${
                              mapping[header] ? "" : "text-muted-foreground"
                            }`}
                          >
                            <option value="">Don&apos;t import</option>
                            {IMPORT_FIELDS.map((field) => (
                              <option key={field} value={field}>
                                {IMPORT_FIELD_LABELS[field]}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {hasMissingClassData && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">
                        Missing Class or Section Information
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 mb-3">
                        Some rows in your file don't specify a class or section.
                        Please select a fallback class to apply to those rows.
                      </p>
                      <div className="flex gap-3">
                        <select
                          className="h-9 px-3 rounded-lg border bg-background text-sm"
                          value={globalClassId}
                          onChange={(e) => {
                            setGlobalClassId(e.target.value);
                            setGlobalSectionId("");
                          }}
                        >
                          <option value="">Select fallback class...</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-9 px-3 rounded-lg border bg-background text-sm"
                          value={globalSectionId}
                          onChange={(e) => setGlobalSectionId(e.target.value)}
                          disabled={!globalClassId}
                        >
                          <option value="">Select section...</option>
                          {selectedClassObj?.sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">
                    Preview Data ({parsedData.length} records)
                  </h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">
                            Admission No
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">
                            Name
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">
                            Class
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">
                            Section
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">
                            Parent Name
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">
                            Parent Phone
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 50).map((row, i) => (
                          <tr
                            key={i}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-4 py-2">
                              {row.admissionNumber || (
                                <span className="text-muted-foreground italic">
                                  Auto
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {row.name}
                            </td>
                            <td className="px-4 py-2">
                              {row.class || (
                                <span className="text-amber-600 font-semibold">
                                  {classes.find((c) => c.id === globalClassId)
                                    ?.name || "Missing"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {row.section || (
                                <span className="text-amber-600 font-semibold">
                                  {selectedClassObj?.sections.find(
                                    (s) => s.id === globalSectionId,
                                  )?.name || "Missing"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2">{row.parentName}</td>
                            <td className="px-4 py-2">{row.parentPhone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 50 && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Showing first 50 rows
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && report && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col items-center py-8"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Import Complete</h3>
                <p className="text-muted-foreground mb-8">
                  Your student data has been processed.
                </p>

                <div className="grid grid-cols-3 gap-4 w-full max-w-lg mb-8">
                  <div className="border rounded-xl p-4 text-center bg-green-50 dark:bg-green-950/20 border-green-200">
                    <p className="text-3xl font-bold text-green-700">
                      {report.imported}
                    </p>
                    <p className="text-xs text-green-600 font-medium uppercase mt-1">
                      Imported
                    </p>
                  </div>
                  <div className="border rounded-xl p-4 text-center bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-3xl font-bold text-amber-700">
                      {report.skipped}
                    </p>
                    <p className="text-xs text-amber-600 font-medium uppercase mt-1">
                      Skipped (Dupes)
                    </p>
                  </div>
                  <div className="border rounded-xl p-4 text-center bg-red-50 dark:bg-red-950/20 border-red-200">
                    <p className="text-3xl font-bold text-red-700">
                      {report.failed}
                    </p>
                    <p className="text-xs text-red-600 font-medium uppercase mt-1">
                      Failed
                    </p>
                  </div>
                </div>

                {report.errors.length > 0 && (
                  <div className="w-full max-w-lg bg-red-50/50 dark:bg-red-950/10 border border-red-100 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-red-800 mb-2">
                      Error Details
                    </h4>
                    <ul className="text-xs text-red-700 list-disc pl-4 space-y-1 max-h-32 overflow-y-auto">
                      {report.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex justify-between items-center">
          <div>
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="text-sm text-muted-foreground hover:text-foreground"
                disabled={loading}
              >
                Back to Upload
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step < 3 && (
              <button
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 border rounded-lg text-sm hover:bg-muted"
                disabled={loading}
              >
                Cancel
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleImport}
                disabled={
                  loading ||
                  missingColumns.length > 0 ||
                  (hasMissingClassData && (!globalClassId || !globalSectionId))
                }
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Start Import"
                )}
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  window.location.reload();
                }}
                className="h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
