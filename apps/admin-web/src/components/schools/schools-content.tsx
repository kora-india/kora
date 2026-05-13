"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  ShieldOff, ShieldCheck, MoreVertical, Copy, Eye, EyeOff, Loader2, ChevronDown,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createSchool, toggleSchoolStatus, updateSchoolPlan } from "@/lib/actions/schools";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";

const PLAN_BADGE: Record<string, string> = {
  FREE: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700",
  BASIC: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  PRO: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  ENTERPRISE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
};

const CreateSchoolFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  subdomain: z
    .string()
    .min(3, "Subdomain must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, hyphens"),
  email: z.string().email("Valid email required").or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  plan: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]),
  adminName: z.string().min(2, "Admin name required"),
  adminEmail: z.string().email("Valid admin email required"),
  seedDefaultClasses: z.boolean(),
});

type CreateSchoolForm = z.infer<typeof CreateSchoolFormSchema>;

interface SuccessState {
  adminEmail: string;
  tempPassword: string;
  schoolName: string;
}

interface SchoolsContentProps {
  schools: any[];
}

export function SchoolsContent({ schools }: SchoolsContentProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [planTarget, setPlanTarget] = useState<{ school: any; plan: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const form = useForm<CreateSchoolForm>({
    resolver: zodResolver(CreateSchoolFormSchema),
    defaultValues: { plan: "FREE", seedDefaultClasses: false },
  });

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.subdomain.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (data: CreateSchoolForm) => {
    const result = await createSchool(data);
    if (result.error) { toast.error(result.error); return; }
    setCreateOpen(false);
    form.reset();
    setSuccessState({
      adminEmail: result.adminEmail!,
      tempPassword: result.tempPassword!,
      schoolName: data.name,
    });
    router.refresh();
  };

  const handleToggleStatus = async () => {
    if (!suspendTarget) return;
    const result = await toggleSchoolStatus(suspendTarget.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(result.message);
    setSuspendTarget(null);
    router.refresh();
  };

  const handlePlanChange = async () => {
    if (!planTarget) return;
    const result = await updateSchoolPlan(planTarget.school.id, planTarget.plan);
    if (result.error) { toast.error(result.error); return; }
    toast.success(result.message);
    setPlanTarget(null);
    router.refresh();
  };

  // Auto-generate subdomain from name
  const watchName = form.watch("name");

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-muted-foreground text-sm mt-1">{schools.length} schools registered</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add School
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Search by name, subdomain, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">School</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Subdomain</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Plan</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Students</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Teachers</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                <td className="h-12 px-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.email ?? s.phone ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="h-12 px-4 text-xs text-muted-foreground font-mono">{s.subdomain}</td>
                <td className="h-12 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${PLAN_BADGE[s.plan] ?? PLAN_BADGE.FREE}`}>
                    {s.plan}
                  </span>
                </td>
                <td className="h-12 px-4 text-xs">{s._count.students}</td>
                <td className="h-12 px-4 text-xs">{s._count.teachers}</td>
                <td className="h-12 px-4">
                  {s.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                      <XCircle className="w-3 h-3" /> Suspended
                    </span>
                  )}
                </td>
                <td className="h-12 px-4">
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="School actions"
                      onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {openMenuId === s.id && (
                      <div className="absolute right-0 top-full mt-1 z-10 w-48 rounded-xl border bg-card shadow-lg py-1">
                        <div className="px-3 py-1.5 border-b">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Change Plan</p>
                        </div>
                        {["FREE", "BASIC", "PRO", "ENTERPRISE"].filter((p) => p !== s.plan).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => { setPlanTarget({ school: s, plan: p }); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                          >
                            <span className={`w-2 h-2 rounded-full ${p === "PRO" ? "bg-violet-500" : p === "ENTERPRISE" ? "bg-amber-500" : p === "BASIC" ? "bg-blue-500" : "bg-gray-400"}`} />
                            Upgrade to {p}
                          </button>
                        ))}
                        <div className="border-t mt-1 pt-1">
                          <button
                            type="button"
                            onClick={() => { setSuspendTarget(s); setOpenMenuId(null); }}
                            className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                              s.isActive
                                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                : "text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                            }`}
                          >
                            {s.isActive ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                            {s.isActive ? "Suspend School" : "Reactivate School"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Building2 className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-sm font-semibold mb-1">{search ? "No schools match your search" : "No schools yet"}</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {search ? "Try a different keyword." : "Create your first school to get started."}
                    </p>
                    {!search && (
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add School
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* ── Create School Dialog ────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); form.reset(); } }}
        title="Create New School"
        description="Set up a new school tenant. A temporary password will be generated for the admin."
        className="max-w-lg"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="School Name" error={form.formState.errors.name?.message} required className="col-span-2">
              <input
                {...form.register("name")}
                className={inputCls}
                placeholder="e.g. Delhi Public School"
                onChange={(e) => {
                  form.setValue("name", e.target.value);
                  const auto = e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  if (!form.getValues("subdomain")) form.setValue("subdomain", auto);
                }}
              />
            </FormField>

            <FormField label="Subdomain" error={form.formState.errors.subdomain?.message} required>
              <input {...form.register("subdomain")} className={inputCls} placeholder="delhi-public" />
            </FormField>

            <FormField label="Plan" error={form.formState.errors.plan?.message} required>
              <select {...form.register("plan")} className={selectCls}>
                <option value="FREE">FREE</option>
                <option value="BASIC">BASIC</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </FormField>

            <FormField label="Contact Email" error={form.formState.errors.email?.message} className="col-span-2">
              <input {...form.register("email")} type="email" className={inputCls} placeholder="school@example.com" />
            </FormField>

            <FormField label="Phone" className="col-span-1">
              <input {...form.register("phone")} className={inputCls} placeholder="+91 98765 43210" />
            </FormField>

            <FormField label="Address" className="col-span-1">
              <input {...form.register("address")} className={inputCls} placeholder="City, State" />
            </FormField>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold mb-3">First Admin Account</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Admin Name" error={form.formState.errors.adminName?.message} required>
                <input {...form.register("adminName")} className={inputCls} placeholder="Full name" />
              </FormField>
              <FormField label="Admin Email" error={form.formState.errors.adminEmail?.message} required>
                <input {...form.register("adminEmail")} type="email" className={inputCls} placeholder="admin@school.com" />
              </FormField>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" {...form.register("seedDefaultClasses")} className="rounded" />
            <span className="text-xs text-muted-foreground">Seed default classes (Grade 6–12 with Sections A & B)</span>
          </label>

          <div className="flex gap-2 justify-end pt-1 border-t">
            <button type="button" onClick={() => setCreateOpen(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {form.formState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create School
            </button>
          </div>
        </form>
      </Dialog>

      {/* ── Onboarding Success Dialog ───────────────────────── */}
      <Dialog
        open={!!successState}
        onOpenChange={(open) => { if (!open) { setSuccessState(null); setShowTempPassword(false); } }}
        title="School Created!"
        description={`"${successState?.schoolName}" is ready. Share these credentials with the admin.`}
        className="max-w-sm"
      >
        {successState && (
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Admin Email</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{successState.adminEmail}</p>
                  <button
                    type="button"
                    aria-label="Copy admin email"
                    onClick={() => { navigator.clipboard.writeText(successState.adminEmail); toast.success("Copied!"); }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Temporary Password</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-mono font-semibold">
                    {showTempPassword ? successState.tempPassword : "••••••••••••"}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={showTempPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      {showTempPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <button
                      type="button"
                      aria-label="Copy temporary password"
                      onClick={() => { navigator.clipboard.writeText(successState.tempPassword); toast.success("Password copied!"); }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              ⚠️ Save this password now. It will not be shown again. The admin should change it after first login.
            </p>
            <button
              type="button"
              onClick={() => { setSuccessState(null); setShowTempPassword(false); }}
              className="w-full h-9 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </Dialog>

      {/* ── Suspend Confirm ─────────────────────────────────── */}
      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}
        title={suspendTarget?.isActive ? "Suspend School" : "Reactivate School"}
        description={
          suspendTarget?.isActive
            ? `Suspend "${suspendTarget?.name}"? All users in this school will lose access immediately.`
            : `Reactivate "${suspendTarget?.name}"? All users will regain access.`
        }
        confirmLabel={suspendTarget?.isActive ? "Suspend" : "Reactivate"}
        onConfirm={handleToggleStatus}
      />

      {/* ── Plan Change Confirm ──────────────────────────────── */}
      <ConfirmDialog
        open={!!planTarget}
        onOpenChange={(open) => { if (!open) setPlanTarget(null); }}
        title="Change Plan"
        description={`Change "${planTarget?.school?.name}" to the ${planTarget?.plan} plan?`}
        confirmLabel="Change Plan"
        onConfirm={handlePlanChange}
      />
    </div>
  );
}
