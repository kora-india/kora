"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@schoolos/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { inputCls } from "@/components/ui/form-field";
import { undoFeeImport } from "@/lib/actions/fee-import";
import {
  checkFeeHistory,
  finishFeeHistoryImport,
  getFeeHistorySetup,
  getFeeHistoryTemplate,
  importFeeHistoryBatch,
  startFeeHistoryImport,
  type FeeHistorySetup,
  type FeeHistorySummary,
} from "@/lib/actions/fee-history";
import {
  HISTORY_TEMPLATE_INSTRUCTIONS,
  batchHistoryRows,
  findHistoryColumns,
  findSharedReceipts,
  monthsBetween,
  toHistoryRow,
  type FeeHistoryRow,
  type HistoryTotals,
} from "@/lib/fees/fee-history";
import { readSpreadsheet } from "@/lib/read-spreadsheet";
import {
  ImportNotice as Notice,
  ImportStep as Step,
  ImportTotal as Total,
} from "./import-parts";

/** Rows sent per request: about 200 KB, well under the server's limits. */
const BATCH_SIZE = 1000;
const MAX_PROBLEMS_SHOWN = 200;

const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

type FileCheck = {
  problems: string[];
  totals: HistoryTotals;
  newHeads: string[];
  newSessions: string[];
  heads: string[];
  periods: string[];
};

type Finished = Extract<
  Awaited<ReturnType<typeof finishFeeHistoryImport>>,
  { success: true }
>;

const emptyTotals: HistoryTotals = {
  bills: 0,
  payments: 0,
  billed: 0,
  lateFees: 0,
  discounts: 0,
  paid: 0,
  dues: 0,
  advance: 0,
  alreadyBilled: 0,
  inOpeningBalance: 0,
  undatedPayments: 0,
};

const addTotals = (a: HistoryTotals, b: HistoryTotals) =>
  Object.fromEntries(
    (Object.keys(a) as (keyof HistoryTotals)[]).map((k) => [
      k,
      Math.round((a[k] + b[k]) * 100) / 100,
    ]),
  ) as unknown as HistoryTotals;

const rowOf = (problem: string) => Number(/^Row (\d+)/.exec(problem)?.[1] ?? 0);

/** The pre-filled template, as an Excel file the browser downloads. */
async function downloadTemplate(headers: string[], rows: string[][]) {
  const { utils, writeFile } = await import("xlsx");
  // Fee amounts sit between Month and Late Fee; Excel adds up numbers.
  const firstAmount = headers.indexOf("Month") + 1;
  const lastAmount = headers.indexOf("Paid On");
  const sheet = utils.aoa_to_sheet([
    headers,
    ...rows.map((row) =>
      row.map((cell, column) =>
        cell && column >= firstAmount && column < lastAmount
          ? Number(cell)
          : cell,
      ),
    ),
  ]);
  // Text cells, so Excel doesn't turn "Apr 2026" into a date of its own.
  for (let row = 2; row <= rows.length + 1; row++) {
    for (const column of ["A", "E"]) {
      const cell = sheet[`${column}${row}`];
      if (cell) cell.z = "@";
    }
  }
  sheet["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Fee History");
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet(HISTORY_TEMPLATE_INSTRUCTIONS.map((line) => [line])),
    "Instructions",
  );
  writeFile(book, "fee-history-template.xlsx");
}

export function ImportHistoryDialog({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const router = useRouter();
  const [setup, setSetup] = useState<FeeHistorySetup | null>(null);
  const [loadError, setLoadError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [calculateLateFees, setCalculateLateFees] = useState(false);
  const [continueLateFees, setContinueLateFees] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<FeeHistoryRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<FileCheck | null>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const [undoTarget, setUndoTarget] = useState<FeeHistorySummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSetup = async () => {
    const res = await getFeeHistorySetup().catch(() => ({
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
    setFrom("");
    setTo("");
    setCalculateLateFees(false);
    setContinueLateFees(false);
    setCheck(null);
    setResult(null);
    void loadSetup();
  }, [open]);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const res = await getFeeHistoryTemplate({ from, to });
      if ("error" in res) toast.error(res.error);
      else if (res.rows.length === 0) {
        toast.error("Every student already has bills for these months");
      } else await downloadTemplate(res.headers, res.rows);
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
      const sheet = await readSpreadsheet(file);
      const columns = findHistoryColumns(sheet.headers);
      if ("missing" in columns) {
        toast.error(
          `This isn't the template: no ${columns.missing.join(", ")} column. Download the template and fill that in.`,
        );
        return;
      }
      const fileRows = sheet.rows
        .map(({ cells, sheetRow }) => toHistoryRow(cells, sheetRow, columns))
        .filter((row): row is FeeHistoryRow => row !== null);
      if (fileRows.length === 0) {
        toast.error("This file has no fee amounts or payments in it");
        return;
      }

      const merged: FileCheck = {
        problems: findSharedReceipts(fileRows),
        totals: emptyTotals,
        newHeads: [],
        newSessions: [],
        heads: [],
        periods: [],
      };
      const batches = batchHistoryRows(fileRows, BATCH_SIZE);
      for (const [index, batch] of batches.entries()) {
        setProgress(`Checking ${index + 1} of ${batches.length}`);
        const res = await checkFeeHistory({ rows: batch, calculateLateFees });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        merged.problems.push(...res.problems);
        merged.totals = addTotals(merged.totals, res.totals);
        merged.newHeads.push(...res.newHeads);
        merged.newSessions.push(...res.newSessions);
        merged.heads.push(...res.heads);
        merged.periods.push(...res.periods);
      }
      setRows(fileRows);
      setFileName(file.name);
      setCheck({
        ...merged,
        problems: [...new Set(merged.problems)].sort(
          (a, b) => rowOf(a) - rowOf(b),
        ),
        newHeads: [...new Set(merged.newHeads)],
        newSessions: [...new Set(merged.newSessions)],
        heads: [...new Set(merged.heads)],
        periods: [...new Set(merged.periods)],
      });
    } catch {
      toast.error("Couldn't read that file. Please check its format.");
    } finally {
      setBusy(false);
      setProgress("");
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!check) return;
    setBusy(true);
    let importId: string | null = null;
    try {
      const started = await startFeeHistoryImport({
        fileName,
        calculateLateFees,
        continueLateFees,
        periods: check.periods,
        heads: check.heads,
      });
      if ("error" in started) {
        toast.error(started.error);
        return;
      }
      importId = started.id;

      const batches = batchHistoryRows(rows, BATCH_SIZE);
      for (const [index, batch] of batches.entries()) {
        setProgress(`Importing ${index + 1} of ${batches.length}`);
        const res = await importFeeHistoryBatch({ importId, rows: batch });
        if ("error" in res) throw new Error(res.error);
      }
      const finished = await finishFeeHistoryImport(importId);
      if ("error" in finished) throw new Error(finished.error);

      setResult(finished);
      router.refresh();
    } catch (e) {
      // All of it or none of it: take back whatever already went in.
      if (importId) await undoFeeImport(importId).catch(() => null);
      toast.error(
        `Nothing was saved. ${e instanceof Error ? e.message : "The import failed."}`,
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const handleUndo = async () => {
    if (!undoTarget) return;
    const res = await undoFeeImport(undoTarget.id).catch(() => ({
      error: "Couldn't undo the import",
    }));
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Import undone");
    await loadSetup();
    router.refresh();
  };

  const notReady = setup
    ? !setup.session
      ? "Set a current academic session in Fee Settings first."
      : setup.studentCount === 0
        ? "Add your students first, then import their fee history."
        : ""
    : "";
  const monthCount = from && to ? monthsBetween(from, to).length : 0;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Import Fee History"
        description="Bring in bills, late fees and payments, month by month"
        icon={<History className="w-5 h-5" />}
        className="max-w-2xl"
      >
        {!setup && !loadError && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {loadError && <Notice>{loadError}</Notice>}
        {setup && notReady && <Notice>{notReady}</Notice>}

        {setup && !notReady && !check && (
          <div className="space-y-5">
            <Step number={1} title="Choose the months">
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-muted-foreground">
                  From
                  <input
                    type="month"
                    value={from}
                    max={to || setup.currentMonth}
                    onChange={(e) => setFrom(e.target.value)}
                    className={`${inputCls} mt-1 w-44 block text-foreground`}
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
                    className={`${inputCls} mt-1 w-44 block text-foreground`}
                  />
                </label>
              </div>
              {monthCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  One row for each of your{" "}
                  {plural(setup.studentCount, "student")} for each of{" "}
                  {plural(monthCount, "month")}.
                </p>
              )}
            </Step>

            <Step number={2} title="Download the template">
              <p className="text-xs text-muted-foreground mb-2">
                Fee amounts are filled in from your fee structure. Fill in what
                was paid, and change anything that&apos;s different.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy || monthCount === 0}
                className="flex items-center gap-2 h-9 px-4 border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </Step>

            <Step number={3} title="Choose how to handle late fees">
              <p className="text-xs text-muted-foreground mb-2">
                The Late Fee column is always kept as you wrote it, for every
                month.
              </p>
              {setup.lateFeeRule ? (
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={calculateLateFees}
                      onChange={(e) => setCalculateLateFees(e.target.checked)}
                    />
                    <span>
                      Work out blank late fees from our rule (
                      {setup.lateFeeRule})
                      <span className="block text-xs text-muted-foreground">
                        Counted from the 10th of each month until it was paid in
                        full. Type 0 for a month with no late fee.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={continueLateFees}
                      onChange={(e) => setContinueLateFees(e.target.checked)}
                    />
                    <span>
                      Keep adding late fees to unpaid months after importing
                      <span className="block text-xs text-muted-foreground">
                        Leave this off to keep unpaid months as they are in the
                        file.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your school has no late-fee rule set, so unpaid months stay as
                  they are in the file.
                </p>
              )}
            </Step>

            <Step number={4} title="Upload the filled file">
              <input
                ref={fileInput}
                type="file"
                aria-label="Filled fee history"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {progress || "Upload File"}
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
                          {item.finished
                            ? plural(item.billCount, "bill")
                            : "Didn't finish"}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("en-IN")}
                          {item.finished &&
                            ` · ${formatCurrency(item.totalBilled)} billed · ${formatCurrency(item.totalPaid)} paid`}{" "}
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
                          aria-label={`Undo import of ${new Date(item.createdAt).toLocaleDateString("en-IN")}`}
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

        {setup && check && !result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Total
                label="Bills"
                value={check.totals.bills.toLocaleString("en-IN")}
              />
              <Total
                label="Billed"
                value={formatCurrency(check.totals.billed)}
              />
              <Total label="Paid" value={formatCurrency(check.totals.paid)} />
              <Total
                label="Still due"
                value={formatCurrency(check.totals.dues)}
              />
              <Total
                label="Late fees"
                value={formatCurrency(check.totals.lateFees)}
              />
              <Total
                label="Advance"
                value={formatCurrency(check.totals.advance)}
              />
            </div>

            {check.problems.length > 0 && (
              <div
                role="alert"
                className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl"
              >
                <p className="text-sm font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Fix {plural(check.problems.length, "row")} and upload the file
                  again
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

            {check.totals.alreadyBilled > 0 && (
              <Notice>
                {plural(check.totals.alreadyBilled, "month")} already{" "}
                {check.totals.alreadyBilled === 1 ? "has" : "have"} bills in
                Kora and will be left out.
              </Notice>
            )}
            {check.totals.inOpeningBalance > 0 && (
              <Notice>
                {plural(check.totals.inOpeningBalance, "month")}{" "}
                {check.totals.inOpeningBalance === 1 ? "is" : "are"} inside an
                opening balance and will be left out. Undo that import first to
                bring these months in.
              </Notice>
            )}
            {check.totals.undatedPayments > 0 && (
              <Notice>
                {plural(check.totals.undatedPayments, "payment")}{" "}
                {check.totals.undatedPayments === 1 ? "has" : "have"} no Paid On
                date, so {check.totals.undatedPayments === 1 ? "it" : "they"}{" "}
                will use the bill&apos;s due date.
              </Notice>
            )}
            {check.newHeads.length > 0 && (
              <Notice>
                New fee heads will be added for these old bills:{" "}
                {check.newHeads.join(", ")}.
              </Notice>
            )}
            {check.newSessions.length > 0 && (
              <Notice>
                Past sessions will be added: {check.newSessions.join(", ")}.
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
                  check.totals.bills + check.totals.payments === 0
                }
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {progress || `Import ${plural(check.totals.bills, "bill")}`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">Fee history imported</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              {plural(result.students, "student")} ·{" "}
              {plural(result.bills, "bill")} · {formatCurrency(result.billed)}{" "}
              billed · {formatCurrency(result.paid)} paid ·{" "}
              {formatCurrency(result.dues)} still due
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
        description="This removes its bills, payments and advances."
        confirmLabel="Undo Import"
        onConfirm={handleUndo}
      />
    </>
  );
}
