"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { selectCls, inputCls } from "@/components/ui/form-field";
import {
  getPromotionPlan,
  promoteStudents,
  undoPromotion,
} from "@/lib/actions/promotion";
import {
  planPromotion,
  summarizePlan,
  type Destination,
  type PlanClass,
  type PlanStudent,
  type PromotionAction,
  type PromotionException,
} from "@/lib/promotion";

type Plan = Extract<
  Awaited<ReturnType<typeof getPromotionPlan>>,
  { success: true }
>;
type Summary = Record<PromotionAction, number>;

const toValue = (d: Destination) =>
  d.kind === "CLASS" ? `class:${d.classId}` : d.kind;
const fromValue = (v: string): Destination =>
  v.startsWith("class:")
    ? { kind: "CLASS", classId: v.slice(6) }
    : { kind: v as "GRADUATE" | "STAY" };

/** What happens, for one student and for several. */
const ACTION_LABELS: Record<PromotionAction, [string, string]> = {
  PROMOTED: ["moves up", "move up"],
  REPEATED: ["repeats their class", "repeat their class"],
  STAYED: ["stays in their class", "stay in their class"],
  GRADUATED: ["graduates", "graduate"],
  LEFT: ["leaves the school", "leave the school"],
};

const studentCount = (n: number) => (n === 1 ? "1 student" : `${n} students`);

function SummaryLine({ summary }: Readonly<{ summary: Summary }>) {
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {(Object.keys(ACTION_LABELS) as PromotionAction[])
        .filter((a) => summary[a] > 0)
        .map((a) => (
          <li key={a}>
            {studentCount(summary[a])}{" "}
            {ACTION_LABELS[a][summary[a] === 1 ? 0 : 1]}
          </li>
        ))}
    </ul>
  );
}

/**
 * Year-end promotion: where each class goes, who doesn't go with their class,
 * a review of where everyone lands, and an undo for the latest run.
 */
export function PromoteStudentsDialog({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [exceptions, setExceptions] = useState<
    Record<string, PromotionException>
  >({});
  const [renumber, setRenumber] = useState(true);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"plan" | "review" | "done">("plan");
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [done, setDone] = useState<{
    batchId: string;
    summary: Summary;
  } | null>(null);

  const load = async () => {
    setLoadError(null);
    const res = await getPromotionPlan();
    if (!res.success) {
      setLoadError(res.error ?? "Couldn't load your classes");
      return;
    }
    setPlan(res);
    setDestinations(
      Object.fromEntries(
        res.classes.map((c) => [c.id, toValue(c.defaultDestination)]),
      ),
    );
    setExceptions({});
    setStep("plan");
    setDone(null);
    setConfirmUndo(false);
  };

  useEffect(() => {
    if (open) void load();
    // Loads fresh each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const classes = useMemo(
    () => (plan?.classes ?? []) as (PlanClass & { studentCount: number })[],
    [plan],
  );
  const students = useMemo(
    () => (plan?.students ?? []) as PlanStudent[],
    [plan],
  );
  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  );
  const sectionName = useMemo(
    () =>
      new Map(
        classes.flatMap((c) => c.sections.map((s) => [s.id, s.name] as const)),
      ),
    [classes],
  );

  const input = useMemo(
    () => ({
      moves: Object.entries(destinations).map(([fromClassId, v]) => ({
        fromClassId,
        to: fromValue(v),
      })),
      exceptions: Object.entries(exceptions).map(([studentId, action]) => ({
        studentId,
        action,
      })),
      renumber,
    }),
    [destinations, exceptions, renumber],
  );
  const preview = useMemo(
    () => (plan ? planPromotion(classes, students, input) : null),
    [plan, classes, students, input],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return students
      .filter(
        (s) =>
          !exceptions[s.id] &&
          (s.name.toLowerCase().includes(q) ||
            s.admissionNumber.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [search, students, exceptions]);

  const placeOf = (classId: string, sectionId: string) =>
    `${classById.get(classId)?.name ?? "?"}-${sectionName.get(sectionId) ?? "?"}`;

  const promote = async () => {
    setBusy(true);
    const res = await promoteStudents(input);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setDone({ batchId: res.batchId, summary: res.summary });
    setStep("done");
    router.refresh();
  };

  const undo = async (batchId: string) => {
    setBusy(true);
    const res = await undoPromotion(batchId);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Undone: ${res.restored} students are back where they were`);
    router.refresh();
    await load();
  };

  const sectionsAfter = useMemo(() => {
    if (!preview || "error" in preview) return [];
    const groups = new Map<string, { label: string; names: string[] }>();
    const nameOf = new Map(students.map((s) => [s.id, s.name]));
    for (const m of preview.moves) {
      if (!m.active) continue;
      const key = m.to.sectionId;
      const g = groups.get(key) ?? {
        label: `${classById.get(m.to.classId)?.name ?? "?"}-${sectionName.get(m.to.sectionId) ?? "?"}`,
        names: [],
      };
      g.names.push(`${m.to.rollNumber}. ${nameOf.get(m.studentId)}`);
      groups.set(key, g);
    }
    return [...groups.values()]
      .map((g) => ({
        ...g,
        names: g.names.sort(
          (a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b),
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  }, [preview, students, classById, sectionName]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Promote students"
      description="Move every class up for the new school year. Nothing changes until you confirm, and you can undo it afterwards."
      icon={<GraduationCap className="w-5 h-5" />}
      className="max-w-3xl"
    >
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : !plan ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : step === "done" && done ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Promotion done
            </p>
            <SummaryLine summary={done.summary} />
          </div>
          <p className="text-xs text-muted-foreground">
            Students who graduated or left are no longer listed, and their bus
            seats were freed. Their unpaid fees stay on record.
          </p>
          <div className="flex justify-between gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => undo(done.batchId)}
              className="inline-flex items-center gap-2 h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-60"
            >
              <Undo2 className="w-4 h-4" /> Undo this promotion
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      ) : step === "review" && preview ? (
        <div className="space-y-5">
          {"error" in preview ? (
            <p
              role="alert"
              className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3"
            >
              {preview.error}
            </p>
          ) : (
            <>
              <SummaryLine summary={summarizePlan(preview.moves)} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Sections after promotion
                </p>
                <div className="grid gap-3 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
                  {sectionsAfter.map((g) => (
                    <div key={g.label} className="rounded-lg border p-3">
                      <p className="text-sm font-semibold">
                        {g.label}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          · {studentCount(g.names.length)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                        {g.names.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep("plan")}
              className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy || "error" in preview}
              onClick={promote}
              className="inline-flex items-center gap-2 h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Promote {students.length} students
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {plan.lastPromotion && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
              <span>
                Last promotion:{" "}
                {new Date(plan.lastPromotion.createdAt).toLocaleDateString(
                  "en-IN",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                )}
              </span>
              {confirmUndo ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Put everyone back?
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => undo(plan.lastPromotion!.batchId)}
                    className="h-8 px-3 rounded-lg bg-destructive text-white text-xs font-medium disabled:opacity-60"
                  >
                    Yes, undo it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmUndo(false)}
                    className="h-8 px-3 rounded-lg border text-xs"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUndo(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Undo it
                </button>
              )}
            </div>
          )}

          <section>
            <h3 className="text-sm font-semibold mb-2">
              Where each class goes
            </h3>
            <div className="rounded-xl border divide-y">
              {classes.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3"
                >
                  <label htmlFor={`dest-${c.id}`} className="text-sm">
                    <span className="font-medium">{c.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      · {studentCount(c.studentCount)}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <ArrowRight
                      className="w-4 h-4 text-muted-foreground hidden sm:block"
                      aria-hidden
                    />
                    <select
                      id={`dest-${c.id}`}
                      value={destinations[c.id] ?? "STAY"}
                      onChange={(e) =>
                        setDestinations((d) => ({
                          ...d,
                          [c.id]: e.target.value,
                        }))
                      }
                      className={`${selectCls} sm:w-56`}
                    >
                      {classes
                        .filter((o) => o.id !== c.id)
                        .map((o) => (
                          <option key={o.id} value={`class:${o.id}`}>
                            {o.name}
                          </option>
                        ))}
                      <option value="STAY">Stays in {c.name}</option>
                      <option value="GRADUATE">
                        Graduates (leaves school)
                      </option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">
              Students who don&apos;t move with their class
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Someone repeating a year, or leaving the school.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                aria-label="Find a student"
                placeholder="Find a student by name or admission number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
            {matches.length > 0 && (
              <ul className="mt-2 rounded-xl border divide-y">
                {matches.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm"
                  >
                    <span>
                      {s.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        {placeOf(s.classId, s.sectionId)} · {s.admissionNumber}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {(["REPEAT", "LEAVE"] as const).map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => {
                            setExceptions((e) => ({ ...e, [s.id]: action }));
                            setSearch("");
                          }}
                          className="h-7 px-2.5 rounded-md border text-xs hover:bg-muted"
                        >
                          {action === "REPEAT"
                            ? "Repeats the year"
                            : "Leaving school"}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(exceptions).length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {Object.entries(exceptions).map(([id, action]) => {
                  const s = students.find((x) => x.id === id)!;
                  return (
                    <li
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 pl-3 pr-1 py-1 text-xs"
                    >
                      {s.name}: {action === "REPEAT" ? "repeats" : "leaving"}
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() =>
                          setExceptions((e) => {
                            const next = { ...e };
                            delete next[id];
                            return next;
                          })
                        }
                        className="p-0.5 rounded-full hover:bg-muted"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={renumber}
              onChange={(e) => setRenumber(e.target.checked)}
              className="mt-0.5 accent-violet-600"
            />
            <span>
              Give new roll numbers in every section, in order of name
              <span className="block text-xs text-muted-foreground">
                Recommended. Otherwise students keep theirs, and clashes are
                flagged.
              </span>
            </span>
          </label>

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
              onClick={() => setStep("review")}
              disabled={students.length === 0}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              Review
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
