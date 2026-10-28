"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { formatCurrency } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { copyFeeStructures } from "@/lib/actions/fee-settings";

interface Session {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string | Date;
}

interface Structure {
  id: string;
  name: string;
  sessionId: string;
  status?: string;
  items?: { amount: unknown; component?: { amount: unknown } | null }[];
}

const ROUNDING = [1, 10, 50, 100] as const;

const structureTotal = (s: Structure, adjust: (n: number) => number) =>
  (s.items ?? []).reduce(
    (sum, i) => sum + adjust(Number(i.amount ?? i.component?.amount ?? 0)),
    0,
  );

/**
 * Starts a session's fees from another one's: structures, their classes and,
 * optionally, student concessions, with an optional fee increase.
 */
export function CopyFeeStructuresDialog({
  open,
  onOpenChange,
  sessions,
  structures,
  defaultToSessionId,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: Session[];
  structures: Structure[];
  defaultToSessionId?: string;
}>) {
  const router = useRouter();
  const byStart = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      ),
    [sessions],
  );
  const withStructures = (id: string) =>
    structures.some(
      (s) => s.sessionId === id && (s.status ?? "ACTIVE") === "ACTIVE",
    );

  const [toId, setToId] = useState("");
  const [fromId, setFromId] = useState("");
  const [percent, setPercent] = useState("0");
  const [roundTo, setRoundTo] = useState<(typeof ROUNDING)[number]>(10);
  const [concessions, setConcessions] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const to =
      defaultToSessionId ??
      byStart.find((s) => s.isCurrent)?.id ??
      byStart[0]?.id ??
      "";
    setToId(to);
    // The latest earlier session that has fees, else any other with fees.
    const toStart = new Date(
      byStart.find((s) => s.id === to)?.startDate ?? 0,
    ).getTime();
    const from =
      byStart.find(
        (s) =>
          s.id !== to &&
          new Date(s.startDate).getTime() < toStart &&
          withStructures(s.id),
      ) ?? byStart.find((s) => s.id !== to && withStructures(s.id));
    setFromId(from?.id ?? "");
    setPercent("0");
    setConcessions(true);
    // Fresh choices each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pct = Number(percent) || 0;
  const adjust = (n: number) =>
    pct === 0 ? n : Math.round((n * (1 + pct / 100)) / roundTo) * roundTo;

  const targetNames = new Set(
    structures
      .filter((s) => s.sessionId === toId)
      .map((s) => s.name.trim().toLowerCase()),
  );
  const sources = structures.filter(
    (s) => s.sessionId === fromId && (s.status ?? "ACTIVE") === "ACTIVE",
  );
  const toCopy = sources.filter(
    (s) => !targetNames.has(s.name.trim().toLowerCase()),
  );
  const sessionName = (id: string) =>
    sessions.find((s) => s.id === id)?.name ?? "";

  const submit = async () => {
    setSaving(true);
    const res = await copyFeeStructures({
      fromSessionId: fromId,
      toSessionId: toId,
      increasePercent: pct,
      roundTo,
      includeConcessions: concessions,
    });
    setSaving(false);
    if (!("success" in res)) {
      toast.error(res.error);
      return;
    }
    const parts = [
      `Copied ${res.copied.length} fee structure${res.copied.length === 1 ? "" : "s"} to ${sessionName(toId)}`,
      `${res.classesAssigned} class${res.classesAssigned === 1 ? "" : "es"} assigned`,
    ];
    if (concessions)
      parts.push(`${res.concessions} student concessions copied`);
    toast.success(parts.join(", "));
    if (res.skippedClasses.length > 0) {
      toast.info(
        `Already had a structure in ${sessionName(toId)}, so left as they were: ${res.skippedClasses.join(", ")}`,
      );
    }
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Copy fee structures"
      description="Start a session's fees from another one: every structure, the classes it's assigned to, and optionally student concessions."
      icon={<Copy className="w-5 h-5" />}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Copy from" htmlFor="copy-from">
            <select
              id="copy-from"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className={selectCls}
            >
              <option value="" disabled>
                Choose a session
              </option>
              {byStart
                .filter((s) => s.id !== toId)
                .map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    disabled={!withStructures(s.id)}
                  >
                    {s.name}
                    {withStructures(s.id) ? "" : " (no fee structures)"}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Copy to" htmlFor="copy-to">
            <select
              id="copy-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className={selectCls}
            >
              {byStart.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Change fees by (%)"
            htmlFor="copy-percent"
            description="For example 8 for an 8% increase. 0 keeps every amount."
          >
            <input
              id="copy-percent"
              type="number"
              inputMode="decimal"
              min={-50}
              max={100}
              step="0.5"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className={inputCls}
            />
          </FormField>
          {pct !== 0 && (
            <FormField label="Round new amounts to" htmlFor="copy-round">
              <select
                id="copy-round"
                value={roundTo}
                onChange={(e) =>
                  setRoundTo(
                    Number(e.target.value) as (typeof ROUNDING)[number],
                  )
                }
                className={selectCls}
              >
                {ROUNDING.map((r) => (
                  <option key={r} value={r}>
                    Nearest ₹{r}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={concessions}
            onChange={(e) => setConcessions(e.target.checked)}
            className="mt-0.5 accent-violet-600"
          />
          <span>
            Also copy student concessions
            <span className="block text-xs text-muted-foreground">
              Discounts, agreed amounts and exemptions of current students, as
              they are.
            </span>
          </span>
        </label>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {sources.length === 0
              ? "Nothing to copy"
              : `${toCopy.length} of ${sources.length} structures will be copied`}
          </p>
          <ul className="rounded-xl border divide-y max-h-56 overflow-y-auto">
            {sources.map((s) => {
              const exists = targetNames.has(s.name.trim().toLowerCase());
              const before = structureTotal(s, (n) => n);
              const after = structureTotal(s, adjust);
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-2.5 text-sm"
                >
                  <span className={exists ? "text-muted-foreground" : ""}>
                    {s.name}
                  </span>
                  {exists ? (
                    <span className="text-xs text-muted-foreground">
                      Already in {sessionName(toId)}
                    </span>
                  ) : (
                    <span className="text-xs tabular-nums">
                      {pct === 0
                        ? formatCurrency(before)
                        : `${formatCurrency(before)} → ${formatCurrency(after)}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !fromId || !toId || toCopy.length === 0}
            className="inline-flex items-center gap-2 h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Copy {toCopy.length || ""} structures
          </button>
        </div>
      </div>
    </Dialog>
  );
}
