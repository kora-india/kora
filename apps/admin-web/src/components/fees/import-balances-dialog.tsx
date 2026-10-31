"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputCls } from "@/components/ui/form-field";
import {
  checkOpeningBalances,
  getOpeningBalanceSetup,
  getOpeningBalanceTemplate,
  importOpeningBalances,
  undoFeeImport,
  type FeeImportSummary,
  type OpeningBalanceSetup,
} from "@/lib/actions/fee-import";
import {
  TEMPLATE_HEADERS,
  TEMPLATE_INSTRUCTIONS,
  findTemplateColumns,
  firstBilledMonth,
  formatAsOfDate,
  type OpeningBalanceRow,
} from "@/lib/fees/opening-balance";
import { readSpreadsheet } from "@/lib/read-spreadsheet";
import {
  ImportNotice as Notice,
  ImportStep as Step,
  ImportTotal as Total,
} from "./import-parts";

type CheckResult = Extract<
  Awaited<ReturnType<typeof checkOpeningBalances>>,
  { success: true }
>;
type ImportResult = Extract<
  Awaited<ReturnType<typeof importOpeningBalances>>,
  { success: true }
>;

const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

/** The pre-filled template, as an Excel file the browser downloads. */
async function downloadTemplate(
  students: {
    admissionNumber: string;
    name: string;
    className: string;
    section: string;
    rollNumber: string;
    parentName: string;
  }[],
) {
  const { utils, writeFile } = await import("xlsx");
  const sheet = utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ...students.map((s) => [
      s.admissionNumber,
      s.name,
      s.className,
      s.section,
      s.rollNumber,
      s.parentName,
      "",
      "",
    ]),
  ]);
  // Text cells, so Excel keeps an admission number like "0042" as written.
  for (let row = 1; row <= students.length; row++) {
    for (const column of ["A", "E"]) {
      const cell = sheet[`${column}${row + 1}`];
      if (cell) cell.z = "@";
    }
  }
  sheet["!cols"] = [18, 24, 12, 9, 12, 24, 12, 12].map((wch) => ({ wch }));
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Opening Balances");
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet(TEMPLATE_INSTRUCTIONS.map((line) => [line])),
    "Instructions",
  );
  writeFile(book, "opening-balances-template.xlsx");
}

export function ImportBalancesDialog({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const router = useRouter();
  const [setup, setSetup] = useState<OpeningBalanceSetup | null>(null);
  const [loadError, setLoadError] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<OpeningBalanceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [charged, setCharged] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [undoTarget, setUndoTarget] = useState<FeeImportSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSetup = async () => {
    const res = await getOpeningBalanceSetup().catch(() => ({
      error: "Couldn't load this. Please try again.",
    }));
    if ("error" in res) {
      setLoadError(res.error);
      return;
    }
    setSetup(res);
    setAsOfDate((date) => date || res.today);
  };

  useEffect(() => {
    if (!open) return;
    setSetup(null);
    setLoadError("");
    setAsOfDate("");
    setCheck(null);
    setResult(null);
    setCharged(new Set());
    void loadSetup();
  }, [open]);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const res = await getOpeningBalanceTemplate();
      if ("error" in res) toast.error(res.error);
      else await downloadTemplate(res.students);
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
      const columns = findTemplateColumns(sheet.headers);
      if ("missing" in columns) {
        toast.error(
          `This isn't the template: no ${columns.missing.join(", ")} column. Download the template and fill that in.`,
        );
        return;
      }
      const text = (v: unknown) => String(v ?? "").trim();
      const fileRows = sheet.rows.map(({ cells, sheetRow }) => ({
        sheetRow,
        admissionNumber: text(cells[columns.admissionNumber]),
        dues: text(cells[columns.dues]),
        advance: text(cells[columns.advance]),
      }));
      const res = await checkOpeningBalances({ asOfDate, rows: fileRows });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setRows(fileRows);
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
      const res = await importOpeningBalances({
        asOfDate,
        rows,
        fileName,
        chargedComponentIds: [...charged],
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      router.refresh();
    } catch {
      toast.error("Couldn't import the balances");
    } finally {
      setBusy(false);
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

  const toggleCharged = (id: string) =>
    setCharged((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const notReady = setup
    ? !setup.session
      ? "Set a current academic session in Fee Settings first."
      : setup.studentCount === 0
        ? "Add your students first, then import their balances."
        : ""
    : "";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Import Balances"
        description="Bring in what each student owes or has in advance"
        icon={<Wallet className="w-5 h-5" />}
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
            <Step number={1} title="Download the template">
              <p className="text-xs text-muted-foreground mb-2">
                It lists your {plural(setup.studentCount, "student")}. Fill in
                Dues and Advance, and leave both blank for anyone with neither.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                className="flex items-center gap-2 h-9 px-4 border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </Step>

            <Step number={2} title="Choose the balance date">
              <label className="block text-xs text-muted-foreground mb-1">
                Balances are as of
                <input
                  type="date"
                  value={asOfDate}
                  max={setup.today}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className={`${inputCls} mt-1 max-w-48 block text-foreground`}
                />
              </label>
              {asOfDate && (
                <p className="text-xs text-muted-foreground">
                  Kora will bill these students from{" "}
                  {firstBilledMonth(asOfDate)}. Earlier months count as billed.
                </p>
              )}
            </Step>

            <Step number={3} title="Upload the filled file">
              <input
                ref={fileInput}
                type="file"
                aria-label="Filled template"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy || !asOfDate}
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
                          As of {formatAsOfDate(item.asOfDate)}
                        </p>
                        <p className="text-muted-foreground">
                          {plural(item.studentCount, "student")} ·{" "}
                          {formatCurrency(item.totalDues)} dues ·{" "}
                          {formatCurrency(item.totalAdvance)} advance · by{" "}
                          {item.createdByName}
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
                          aria-label={`Undo import as of ${formatAsOfDate(item.asOfDate)}`}
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
            <div className="grid grid-cols-3 gap-3">
              <Total
                label="Students"
                value={check.students.toLocaleString("en-IN")}
              />
              <Total
                label={`Dues (${plural(check.withDues, "student")})`}
                value={formatCurrency(check.totalDues)}
              />
              <Total
                label={`Advance (${plural(check.withAdvance, "student")})`}
                value={formatCurrency(check.totalAdvance)}
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
                  {check.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            )}

            {check.alreadyImported > 0 && (
              <Notice>
                {plural(check.alreadyImported, "student")} already{" "}
                {check.alreadyImported === 1 ? "has" : "have"} an opening
                balance and will be left out.
              </Notice>
            )}
            {check.withExistingBills > 0 && check.totalDues > 0 && (
              <Notice>
                {plural(check.withExistingBills, "student")} already{" "}
                {check.withExistingBills === 1 ? "has" : "have"} bills in Kora.
                Dues in this file are added to those bills.
              </Notice>
            )}

            {setup.feeHeads.length > 0 && check.problems.length === 0 && (
              <fieldset>
                <legend className="text-sm font-semibold">
                  Already charged?
                </legend>
                <p className="text-xs text-muted-foreground mb-2">
                  Tick the fees you have already charged these students, so Kora
                  doesn&apos;t bill them again.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {setup.feeHeads.map((head) => (
                    <label
                      key={head.id}
                      className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={charged.has(head.id)}
                        onChange={() => toggleCharged(head.id)}
                      />
                      {head.name}
                      <span className="text-xs text-muted-foreground">
                        {head.frequency.replace("_", " ").toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
                  busy || check.problems.length > 0 || check.students === 0
                }
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {plural(check.students, "student")}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">Balances imported</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              {plural(result.students, "student")} ·{" "}
              {formatCurrency(result.totalDues)} dues ·{" "}
              {formatCurrency(result.totalAdvance)} advance
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
        description="This removes its dues and advances. Kora will bill these students as usual again."
        confirmLabel="Undo Import"
        onConfirm={handleUndo}
      />
    </>
  );
}
