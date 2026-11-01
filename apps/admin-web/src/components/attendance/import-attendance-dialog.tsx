"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  ImportNotice as Notice,
  ImportStep as Step,
  ImportTotal as Total,
} from "@/components/fees/import-parts";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { inputCls } from "@/components/ui/form-field";
import {
  checkAttendanceImport,
  getAttendanceImportSetup,
  getAttendanceTemplate,
  importAttendance,
  undoAttendanceImport,
  type AttendanceImportSetup,
  type AttendanceImportSummary,
} from "@/lib/actions/attendance-import";
import {
  attendanceSheetName,
  readAttendanceSheets,
  type AttendanceRow,
  type AttendanceTotals,
} from "@/lib/attendance-import";
import { downloadAttendanceTemplate } from "@/lib/attendance-template";
import { monthsBetween } from "@/lib/fees/fee-history";
import { readSpreadsheetSheets } from "@/lib/read-spreadsheet";

const MAX_PROBLEMS_SHOWN = 200;

const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

type Check = { problems: string[]; totals: AttendanceTotals };

type Finished = Extract<
  Awaited<ReturnType<typeof importAttendance>>,
  { success: true }
>;

const monthRange = ({ fromMonth, toMonth }: AttendanceImportSummary) =>
  fromMonth === toMonth
    ? attendanceSheetName(fromMonth)
    : `${attendanceSheetName(fromMonth)} – ${attendanceSheetName(toMonth)}`;

/** Past attendance for one section, from a filled template. */
export function ImportAttendanceDialog({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const router = useRouter();
  const [setup, setSetup] = useState<AttendanceImportSetup | null>(null);
  const [loadError, setLoadError] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const [undoTarget, setUndoTarget] = useState<AttendanceImportSummary | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSetup = async () => {
    const res = await getAttendanceImportSetup().catch(() => ({
      error: "Couldn't load this. Please try again.",
    }));
    if ("error" in res) {
      setLoadError(res.error);
      return;
    }
    setSetup(res);
    setFrom((month) => month || res.firstMonth);
    setTo((month) => month || res.currentMonth);
  };

  useEffect(() => {
    if (!open) return;
    setSetup(null);
    setLoadError("");
    setClassId("");
    setSectionId("");
    setFrom("");
    setTo("");
    setCheck(null);
    setResult(null);
    void loadSetup();
  }, [open]);

  const sections = setup?.classes.find((c) => c.id === classId)?.sections ?? [];
  const className = setup?.classes.find((c) => c.id === classId)?.name;
  const sectionName = sections.find((s) => s.id === sectionId)?.name;
  const monthCount = from && to ? monthsBetween(from, to).length : 0;
  const chosen = Boolean(classId && sectionId);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const res = await getAttendanceTemplate({
        classId,
        sectionId,
        from,
        to,
      });
      if ("error" in res) toast.error(res.error);
      else await downloadAttendanceTemplate(res);
    } catch {
      toast.error("Couldn't create the template");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const sheets = await readSpreadsheetSheets(file);
      const read = readAttendanceSheets(sheets);
      if (!read) {
        toast.error(
          "This isn't the template. Download the template and fill that in.",
        );
        return;
      }
      const filled = read.rows.filter((r) => Object.keys(r.marks).length > 0);
      if (filled.length === 0) {
        toast.error("This file has no attendance in it");
        return;
      }
      const res = await checkAttendanceImport({
        classId,
        sectionId,
        rows: filled,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setRows(filled);
      setFileName(file.name);
      setCheck(res);
    } catch {
      toast.error("Couldn't read that file. Please check its format.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      const res = await importAttendance({
        classId,
        sectionId,
        fileName,
        rows,
      });
      if ("error" in res) {
        toast.error(`Nothing was saved. ${res.error}`);
        return;
      }
      setResult(res);
      router.refresh();
    } catch {
      toast.error("Nothing was saved. The import failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!undoTarget) return;
    const res = await undoAttendanceImport(undoTarget.id).catch(() => ({
      error: "Couldn't undo the import",
    }));
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.kept > 0
        ? `Import undone. ${plural(res.kept, "record")} changed since stayed.`
        : "Import undone",
    );
    await loadSetup();
    router.refresh();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Import Attendance"
        description="Bring in past attendance, one section at a time"
        icon={<Upload className="w-5 h-5" />}
        className="max-w-2xl"
      >
        {!setup && !loadError && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {loadError && <Notice>{loadError}</Notice>}
        {setup && setup.classes.length === 0 && (
          <Notice>You have no class sections to import attendance for.</Notice>
        )}

        {setup && setup.classes.length > 0 && !check && !result && (
          <div className="space-y-5">
            <Step number={1} title="Choose the section and months">
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <label className="text-xs text-muted-foreground">
                  Class
                  <select
                    aria-label="Class"
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setSectionId("");
                    }}
                    className={`${inputCls} mt-1 block text-foreground`}
                  >
                    <option value="">Select class</option>
                    {setup.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Section
                  <select
                    aria-label="Section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    disabled={!classId}
                    className={`${inputCls} mt-1 block text-foreground`}
                  >
                    <option value="">Select section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  From
                  <input
                    type="month"
                    value={from}
                    max={to || setup.currentMonth}
                    onChange={(e) => setFrom(e.target.value)}
                    className={`${inputCls} mt-1 block text-foreground`}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  To
                  <input
                    type="month"
                    value={to}
                    min={from}
                    max={setup.currentMonth}
                    onChange={(e) => setTo(e.target.value)}
                    className={`${inputCls} mt-1 block text-foreground`}
                  />
                </label>
              </div>
            </Step>

            <Step number={2} title="Download the template">
              <p className="text-xs text-muted-foreground mb-2">
                {chosen
                  ? `${className} ${sectionName}: one sheet for each of ${plural(monthCount, "month")}, with a row for each student and a column for each day.`
                  : "Choose a class and section first."}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy || !chosen || monthCount === 0}
                className="flex items-center gap-2 h-9 px-4 border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </Step>

            <Step number={3} title="Upload the filled file">
              <p className="text-xs text-muted-foreground mb-2">
                Use P, A, L or E. Days already marked in Kora stay as they are.
              </p>
              <input
                ref={fileInput}
                type="file"
                aria-label="Filled attendance"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy || !chosen}
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload File
              </button>
            </Step>

            {setup.imports.length > 0 && (
              <section className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Past imports</h3>
                <ul className="space-y-2">
                  {setup.imports.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0 text-xs">
                        <p className="font-medium text-sm">
                          {item.className} {item.sectionName} ·{" "}
                          {monthRange(item)}
                        </p>
                        <p className="text-muted-foreground">
                          {plural(item.recordCount, "record")} ·{" "}
                          {new Date(item.createdAt).toLocaleDateString("en-IN")}{" "}
                          · by {item.createdByName}
                        </p>
                      </div>
                      {item.undoneAt ? (
                        <span className="text-xs text-muted-foreground">
                          Undone
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUndoTarget(item)}
                          aria-label={`Undo import for ${item.className} ${item.sectionName}, ${monthRange(item)}`}
                          className="h-8 px-3 border rounded-lg text-xs font-medium hover:bg-muted"
                        >
                          Undo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {check && !result && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {className} {sectionName}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Total
                label="Students"
                value={check.totals.students.toLocaleString("en-IN")}
              />
              <Total
                label="Days"
                value={check.totals.days.toLocaleString("en-IN")}
              />
              <Total
                label="Present"
                value={check.totals.present.toLocaleString("en-IN")}
              />
              <Total
                label="Absent"
                value={check.totals.absent.toLocaleString("en-IN")}
              />
              <Total
                label="Late"
                value={check.totals.late.toLocaleString("en-IN")}
              />
              <Total
                label="Excused"
                value={check.totals.excused.toLocaleString("en-IN")}
              />
            </div>

            {check.problems.length > 0 && (
              <div
                role="alert"
                className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl"
              >
                <p className="text-sm font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Fix {plural(check.problems.length, "problem")} and upload the
                  file again
                </p>
                <p className="text-xs text-red-700 dark:text-red-500 mt-1">
                  Nothing has been saved.
                </p>
                <ul className="text-xs text-red-700 dark:text-red-400 list-disc pl-4 mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {check.problems.slice(0, MAX_PROBLEMS_SHOWN).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {check.problems.length > MAX_PROBLEMS_SHOWN && (
                  <p className="text-xs text-red-700 dark:text-red-500 mt-2">
                    And {check.problems.length - MAX_PROBLEMS_SHOWN} more.
                  </p>
                )}
              </div>
            )}

            {check.totals.alreadyInKora > 0 && (
              <Notice>
                {plural(check.totals.alreadyInKora, "record")} already{" "}
                {check.totals.alreadyInKora === 1 ? "is" : "are"} in Kora and
                will be left as{" "}
                {check.totals.alreadyInKora === 1 ? "it is" : "they are"}.
              </Notice>
            )}

            <div className="flex justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCheck(null)}
                disabled={busy}
                className="h-9 px-4 border rounded-lg text-sm hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={
                  busy ||
                  check.problems.length > 0 ||
                  check.totals.records === 0
                }
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {plural(check.totals.records, "record")}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">Attendance imported</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              {plural(result.records, "record")} ·{" "}
              {plural(result.students, "student")} ·{" "}
              {plural(result.days, "day")}
              {result.skipped > 0 && ` · ${result.skipped} already in Kora`}
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-6 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
            >
              Done
            </button>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={undoTarget !== null}
        onOpenChange={(next) => !next && setUndoTarget(null)}
        title="Undo this import?"
        description="This removes its attendance records. Records changed since stay as they are."
        confirmLabel="Undo Import"
        onConfirm={handleUndo}
      />
    </>
  );
}
