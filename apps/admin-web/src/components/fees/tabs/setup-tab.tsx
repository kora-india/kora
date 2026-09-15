"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@schoolos/utils";
import {
  Plus,
  Calendar,
  Layers,
  Receipt,
  Edit2,
  Loader2,
  Settings,
  Clock,
  CheckCircle2,
  Search,
  Check,
  Tag as TagIcon,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import {
  createAcademicSession,
  createFeeComponent,
  createFeeStructure,
  updateAcademicSession,
  updateFeeComponent,
  updateFeeStructure,
  saveLateFeeSettings,
} from "@/lib/actions/fee-settings";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  sessions: any[];
  components: any[];
  structures: any[];
  school: any;
  canEdit: boolean;
}

export function SetupTab({
  sessions = [],
  components = [],
  structures = [],
  school,
  canEdit = false,
}: Readonly<Props>) {
  // Dialog States
  const [sessionDialog, setSessionDialog] = useState(false);
  const [componentDialog, setComponentDialog] = useState(false);
  const [structureDialog, setStructureDialog] = useState(false);

  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editComponentId, setEditComponentId] = useState<string | null>(null);
  const [editStructureId, setEditStructureId] = useState<string | null>(null);

  // Search & Filter State
  const [structureSearch, setStructureSearch] = useState("");
  const [componentSearch, setComponentSearch] = useState("");

  // Forms
  const sessionForm = useForm({
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
    },
  });

  const compForm = useForm({
    defaultValues: {
      name: "",
      amount: 0,
      frequency: "MONTHLY",
      isOptional: false,
    },
  });

  const structForm = useForm({
    defaultValues: {
      name: "",
      sessionId: "",
      componentIds: [] as string[],
      amounts: {} as Record<string, string>,
    },
  });

  const lateFeeForm = useForm({
    defaultValues: {
      lateFeeEnabled: school?.lateFeeEnabled || false,
      lateFeeAmount: Number(school?.lateFeeAmount) || undefined,
      lateFeeFrequency: school?.lateFeeFrequency || "MONTHLY",
    },
  });

  // Dialog Open Handlers
  const openSessionDialog = (session?: any) => {
    if (session) {
      setEditSessionId(session.id);
      sessionForm.reset({
        name: session.name,
        startDate: new Date(session.startDate).toISOString().split("T")[0],
        endDate: new Date(session.endDate).toISOString().split("T")[0],
        isCurrent: session.isCurrent,
      });
    } else {
      setEditSessionId(null);
      sessionForm.reset({
        name: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
      });
    }
    setSessionDialog(true);
  };

  const openComponentDialog = (comp?: any) => {
    if (comp) {
      setEditComponentId(comp.id);
      compForm.reset({
        name: comp.name,
        amount: Number(comp.amount),
        frequency: comp.frequency,
        isOptional: comp.isOptional,
      });
    } else {
      setEditComponentId(null);
      compForm.reset({
        name: "",
        amount: 0,
        frequency: "MONTHLY",
        isOptional: false,
      });
    }
    setComponentDialog(true);
  };

  const openStructureDialog = (struct?: any) => {
    if (struct) {
      setEditStructureId(struct.id);
      const amounts: Record<string, string> = {};
      struct.items?.forEach((i: any) => {
        if (i.amount) amounts[i.componentId] = i.amount.toString();
      });
      structForm.reset({
        name: struct.name,
        sessionId:
          struct.sessionId || sessions.find((s) => s.isCurrent)?.id || "",
        componentIds: struct.items?.map((i: any) => i.componentId) || [],
        amounts,
      });
    } else {
      setEditStructureId(null);
      const activeSession = sessions.find((s) => s.isCurrent) || sessions[0];
      structForm.reset({
        name: "",
        sessionId: activeSession ? activeSession.id : "",
        componentIds: [],
        amounts: {},
      });
    }
    setStructureDialog(true);
  };

  // Submit Handlers
  const onSessionSubmit = async (data: any) => {
    const toastId = "session-submit";
    toast.loading(
      editSessionId ? "Updating session..." : "Creating session...",
      { id: toastId },
    );
    try {
      const res = editSessionId
        ? await updateAcademicSession(editSessionId, data)
        : await createAcademicSession(data);
      if (res.error) toast.error(res.error, { id: toastId });
      else {
        toast.success(editSessionId ? "Session updated" : "Session created", {
          id: toastId,
        });
        setSessionDialog(false);
        sessionForm.reset();
      }
    } catch {
      toast.error("Failed to save academic session", { id: toastId });
    }
  };

  const onCompSubmit = async (data: any) => {
    const toastId = "component-submit";
    toast.loading(
      editComponentId
        ? "Updating fee component..."
        : "Creating fee component...",
      { id: toastId },
    );
    try {
      const res = editComponentId
        ? await updateFeeComponent(editComponentId, {
            ...data,
            amount: Number(data.amount),
          })
        : await createFeeComponent({
            ...data,
            amount: Number(data.amount),
          });
      if (res.error) toast.error(res.error, { id: toastId });
      else {
        toast.success(
          editComponentId ? "Component updated" : "Component created",
          { id: toastId },
        );
        setComponentDialog(false);
        compForm.reset();
      }
    } catch {
      toast.error("Failed to save fee component", { id: toastId });
    }
  };

  const onStructSubmit = async (data: any) => {
    const toastId = "structure-submit";
    toast.loading(
      editStructureId
        ? "Updating fee structure..."
        : "Creating fee structure...",
      { id: toastId },
    );
    try {
      const componentsList = data.componentIds.map((id: string) => ({
        componentId: id,
        amount: data.amounts?.[id] ? Number(data.amounts[id]) : undefined,
      }));
      const payload = {
        name: data.name,
        sessionId: data.sessionId,
        components: componentsList,
      };
      const res = editStructureId
        ? await updateFeeStructure(editStructureId, payload)
        : await createFeeStructure(payload);
      if (res.error) toast.error(res.error, { id: toastId });
      else {
        toast.success(
          editStructureId ? "Structure updated" : "Structure created",
          { id: toastId },
        );
        setStructureDialog(false);
        structForm.reset();
      }
    } catch {
      toast.error("Failed to save fee structure", { id: toastId });
    }
  };

  const onLateFeeSubmit = async (data: any) => {
    const toastId = "late-fee-submit";
    toast.loading("Updating late fee policy...", { id: toastId });
    try {
      const payload = {
        ...data,
        lateFeeAmount: data.lateFeeAmount
          ? Number(data.lateFeeAmount)
          : undefined,
      };
      const res = await saveLateFeeSettings(payload);
      if (res.error) toast.error(res.error, { id: toastId });
      else toast.success("Late fee policy updated", { id: toastId });
    } catch {
      toast.error("Failed to update late fee policy", { id: toastId });
    }
  };

  // Helper Calculations
  const activeSession = sessions.find((s) => s.isCurrent) || sessions[0];

  const filteredStructures = useMemo(() => {
    if (!structureSearch.trim()) return structures;
    const q = structureSearch.toLowerCase();
    return structures.filter(
      (s: any) =>
        s.name.toLowerCase().includes(q) ||
        s.items?.some((i: any) => i.component?.name?.toLowerCase().includes(q)),
    );
  }, [structures, structureSearch]);

  const filteredComponents = useMemo(() => {
    if (!componentSearch.trim()) return components;
    const q = componentSearch.toLowerCase();
    return components.filter(
      (c: any) =>
        c.name.toLowerCase().includes(q) ||
        c.frequency?.toLowerCase().includes(q),
    );
  }, [components, componentSearch]);

  // Live Structure Modal Total Calculation
  const watchedComponentIds = structForm.watch("componentIds") || [];
  const watchedAmounts = structForm.watch("amounts") || {};
  const currentStructureTotal = useMemo(() => {
    return watchedComponentIds.reduce((sum: number, compId: string) => {
      const comp = components.find((c) => c.id === compId);
      const overrideVal = watchedAmounts[compId];
      const amt =
        overrideVal !== undefined && overrideVal !== ""
          ? Number(overrideVal)
          : Number(comp?.amount || 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [watchedComponentIds, watchedAmounts, components]);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP SUMMARY STRIP: Quick Institutional Status Overview     */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Session Card */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:border-violet-300 dark:hover:border-violet-800 transition-colors">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Session
            </p>
            <p className="text-lg font-bold text-foreground">
              {activeSession?.name || "None Set"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {activeSession
                ? `${new Date(activeSession.startDate).getFullYear()} - ${new Date(activeSession.endDate).getFullYear()}`
                : "Configure academic year"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Total Components Card */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:border-amber-300 dark:hover:border-amber-800 transition-colors">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fee Components
            </p>
            <p className="text-lg font-bold text-foreground">
              {components.length} Items
            </p>
            <p className="text-[11px] text-muted-foreground">
              {components.filter((c) => !c.isOptional).length} Mandatory,{" "}
              {components.filter((c) => c.isOptional).length} Optional
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Total Fee Structures Card */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fee Structures
            </p>
            <p className="text-lg font-bold text-foreground">
              {structures.length} Plans
            </p>
            <p className="text-[11px] text-muted-foreground">
              Configured for classes & grades
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Late Fee Status Card */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:border-rose-300 dark:hover:border-rose-800 transition-colors">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Late Fee Rule
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  school?.lateFeeEnabled
                    ? "bg-emerald-500"
                    : "bg-muted-foreground"
                }`}
              />
              <p className="text-lg font-bold text-foreground">
                {school?.lateFeeEnabled
                  ? formatCurrency(Number(school.lateFeeAmount || 0))
                  : "Disabled"}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {school?.lateFeeEnabled
                ? `Auto-applied ${school.lateFeeFrequency?.toLowerCase() || "monthly"}`
                : "No late fines active"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TWO-COLUMN BALANCED SECTION: Sessions & Late Fees | Catalog */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Academic Sessions & Late Fee Policy */}
        <div className="lg:col-span-5 space-y-6">
          {/* Academic Sessions Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Academic Sessions
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    School academic cycle definitions
                  </p>
                </div>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => openSessionDialog()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Session</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {sessions.map((s: any) => (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    s.isCurrent
                      ? "bg-violet-50/40 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/60"
                      : "bg-background hover:bg-muted/30"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-foreground">
                        {s.name}
                      </p>
                      {s.isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.startDate).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      -{" "}
                      {new Date(s.endDate).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openSessionDialog(s)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                      title="Edit session"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="text-center py-6 border border-dashed rounded-xl bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    No academic sessions configured yet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Late Fee Policy Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Late Fee Policy
                </h2>
                <p className="text-xs text-muted-foreground">
                  Automated fine applied to overdue fees
                </p>
              </div>
            </div>

            <form
              onSubmit={lateFeeForm.handleSubmit(onLateFeeSubmit)}
              className="space-y-4"
            >
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Enable Automatic Late Fees
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adds fine to unpaid fees past grace period
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...lateFeeForm.register("lateFeeEnabled")}
                  />
                  <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {lateFeeForm.watch("lateFeeEnabled") && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-1"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Monthly Flat Fine (₹)" required>
                      <input
                        type="number"
                        placeholder="e.g. 200"
                        {...lateFeeForm.register("lateFeeAmount")}
                        className={inputCls}
                      />
                    </FormField>

                    <FormField label="Fine Frequency" required>
                      <select
                        {...lateFeeForm.register("lateFeeFrequency")}
                        className={selectCls}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="PER_TERM">Per Term / Session</option>
                      </select>
                    </FormField>
                  </div>
                </motion.div>
              )}

              {canEdit && (
                <button
                  type="submit"
                  disabled={lateFeeForm.formState.isSubmitting}
                  className="w-full h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {lateFeeForm.formState.isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Save Late Fee Policy
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Column (7 Cols): Fee Components Catalog */}
        <div className="lg:col-span-7">
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">
                        Fee Components Catalog
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {components.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Base billing items (Tuition, Lab, Transport, Admission)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search Components */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search component..."
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-36 sm:w-44 transition-all"
                    />
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openComponentDialog()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Component</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Component Tiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredComponents.map((c: any) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border bg-background hover:bg-muted/20 hover:border-amber-300 dark:hover:border-amber-800 transition-all flex flex-col justify-between space-y-2.5 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                            {c.frequency?.replace(/_/g, " ") || "MONTHLY"}
                          </span>
                          {c.isOptional ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/50">
                              Optional
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              Mandatory
                            </span>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openComponentDialog(c)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                          title="Edit component"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Default Base Rate:
                      </span>
                      <span className="font-black text-sm text-foreground">
                        {formatCurrency(Number(c.amount))}
                      </span>
                    </div>
                  </div>
                ))}

                {filteredComponents.length === 0 && (
                  <div className="col-span-full text-center py-10 border border-dashed rounded-xl bg-muted/10">
                    <p className="text-xs text-muted-foreground">
                      No fee components found.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Helper Tip */}
            <div className="mt-4 p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <HelpCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>
                Tip: Components serve as reusable building blocks. You can
                override amounts when creating Class Fee Structures.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FULL-WIDTH SECTION: Fee Structures (Bundles for Classes)   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Class Fee Structures
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  {structures.length} Plans Defined
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Composite bundles of fee components assigned to classes, grades,
                or student cohorts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Structures */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search structure or class..."
                value={structureSearch}
                onChange={(e) => setStructureSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48 sm:w-60 transition-all"
              />
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => openStructureDialog()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Create Fee Structure</span>
              </button>
            )}
          </div>
        </div>

        {/* Structures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStructures.map((s: any) => {
            // Calculate total fee of the structure
            const totalFee = s.items?.reduce(
              (sum: number, item: any) =>
                sum + Number(item.amount || item.component?.amount || 0),
              0,
            );

            return (
              <div
                key={s.id}
                className="bg-background border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Structure Header */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-foreground group-hover:text-blue-600 transition-colors">
                      {s.name}
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openStructureDialog(s)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="Edit structure"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Total Amount Badge */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      Total Billed Amount:
                    </span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalFee)}
                    </span>
                  </div>
                </div>

                {/* Included Components Chips */}
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Included Components ({s.items?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.items?.map((i: any) => (
                      <span
                        key={i.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 text-foreground border"
                      >
                        <span>{i.component?.name || "Component"}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                          {formatCurrency(
                            Number(i.amount || i.component?.amount || 0),
                          )}
                        </span>
                      </span>
                    ))}
                    {(!s.items || s.items.length === 0) && (
                      <span className="text-xs text-muted-foreground italic">
                        No components attached.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredStructures.length === 0 && (
            <div className="col-span-full text-center py-12 border border-dashed rounded-2xl bg-muted/10">
              <Layers className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                No fee structures match your search.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create bundles for classes like &quot;Class 10 General&quot; or
                &quot;Science Stream&quot;.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DIALOGS: Polished Modals with Real-Time Total Calculations     */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Academic Session Dialog */}
      <Dialog
        open={sessionDialog}
        onOpenChange={setSessionDialog}
        title={
          editSessionId ? "Edit Academic Session" : "Create Academic Session"
        }
      >
        <form
          onSubmit={sessionForm.handleSubmit(onSessionSubmit)}
          className="space-y-4"
        >
          <FormField label="Session Name" required>
            <input
              {...sessionForm.register("name")}
              className={inputCls}
              placeholder="e.g. 2026-27"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <input
                type="date"
                {...sessionForm.register("startDate")}
                className={inputCls}
              />
            </FormField>
            <FormField label="End Date" required>
              <input
                type="date"
                {...sessionForm.register("endDate")}
                className={inputCls}
              />
            </FormField>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                {...sessionForm.register("isCurrent")}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
              <span>Set as active current session for all fee collections</span>
            </label>
          </div>
          <button
            type="submit"
            disabled={sessionForm.formState.isSubmitting}
            className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {sessionForm.formState.isSubmitting && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {editSessionId ? "Save Session Changes" : "Create Session"}
          </button>
        </form>
      </Dialog>

      {/* 2. Fee Component Dialog */}
      <Dialog
        open={componentDialog}
        onOpenChange={setComponentDialog}
        title={editComponentId ? "Edit Fee Component" : "Create Fee Component"}
      >
        <form
          onSubmit={compForm.handleSubmit(onCompSubmit)}
          className="space-y-4"
        >
          <FormField label="Component Name" required>
            <input
              {...compForm.register("name")}
              className={inputCls}
              placeholder="e.g. Tuition Fee, Transport, Exam Fee"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Default Amount (₹)" required>
              <input
                type="number"
                {...compForm.register("amount")}
                className={inputCls}
                placeholder="1000"
              />
            </FormField>
            <FormField label="Billing Frequency" required>
              <select {...compForm.register("frequency")} className={selectCls}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="HALF_YEARLY">Half Yearly</option>
                <option value="YEARLY">Yearly</option>
                <option value="ONE_TIME">One Time</option>
              </select>
            </FormField>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                {...compForm.register("isOptional")}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>
                Optional Component (e.g. Transport, Hostel - not mandatory for
                all students)
              </span>
            </label>
          </div>
          <button
            type="submit"
            disabled={compForm.formState.isSubmitting}
            className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {compForm.formState.isSubmitting && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {editComponentId ? "Save Component Changes" : "Create Component"}
          </button>
        </form>
      </Dialog>

      {/* 3. Fee Structure Dialog */}
      <Dialog
        open={structureDialog}
        onOpenChange={setStructureDialog}
        title={editStructureId ? "Edit Fee Structure" : "Create Fee Structure"}
      >
        <form
          onSubmit={structForm.handleSubmit(onStructSubmit)}
          className="space-y-4"
        >
          <FormField label="Structure Name" required>
            <input
              {...structForm.register("name")}
              className={inputCls}
              placeholder="e.g. Class 10 (PCM), Primary Wing"
            />
          </FormField>

          <FormField label="Academic Session" required>
            <select {...structForm.register("sessionId")} className={selectCls}>
              <option value="">Select an academic session</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isCurrent ? "(Current Active)" : ""}
                </option>
              ))}
            </select>
          </FormField>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Select Components & Set Custom Rates
              </label>
              {watchedComponentIds.length > 0 && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  Total: {formatCurrency(currentStructureTotal)}
                </span>
              )}
            </div>

            <div className="space-y-2 border rounded-xl p-3 max-h-[260px] overflow-y-auto bg-muted/20">
              {components.map((c: any) => {
                const isSelected = watchedComponentIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60"
                        : "bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          value={c.id}
                          {...structForm.register("componentIds")}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-foreground">{c.name}</span>
                        {c.isOptional && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            Optional
                          </span>
                        )}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Base: {formatCurrency(Number(c.amount))}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="mt-2 pl-6 flex items-center justify-between gap-3 text-xs bg-background/80 p-2 rounded-lg border">
                        <span className="text-muted-foreground text-[11px]">
                          Custom Rate Override:
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground font-semibold">
                            ₹
                          </span>
                          <input
                            type="number"
                            {...structForm.register(`amounts.${c.id}`)}
                            className="h-7 w-24 text-xs font-bold rounded-lg border px-2 bg-background text-foreground"
                            placeholder={String(c.amount)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {components.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No components found. Create components first.
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={structForm.formState.isSubmitting}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {structForm.formState.isSubmitting && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {editStructureId
              ? "Save Fee Structure Changes"
              : "Create Fee Structure"}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
