"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@schoolos/utils";
import {
  PERMISSION_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  UserRole,
  moduleLevels,
  permissionsProblem,
  type AccessLevel,
  type Permissions,
} from "@schoolos/types";
import { Dialog } from "@/components/ui/dialog";
import {
  resetMemberPermissions,
  updateMemberPermissions,
} from "@/lib/actions/team";
import type { TeamMember } from "./team-access-content";

const LEVEL_LABELS: Record<AccessLevel, string> = {
  none: "None",
  view: "View",
  manage: "Manage",
};

/**
 * One teacher's or accountant's access, module by module. Mount it when it
 * opens, so it starts from what's saved.
 */
export function MemberAccessDialog({
  member,
  open,
  onOpenChange,
}: Readonly<{
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const router = useRouter();
  const [draft, setDraft] = useState<Permissions>(() => ({
    ...member.permissions,
  }));
  const [saving, setSaving] = useState<"save" | "reset" | null>(null);

  const defaults = ROLE_DEFAULT_PERMISSIONS[member.role];
  const roleName = member.role === UserRole.TEACHER ? "teacher" : "accountant";
  const problem = permissionsProblem(draft);

  const finish = (result: { error: string } | { message: string }) => {
    setSaving(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    onOpenChange(false);
    router.refresh();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setSaving("save");
    finish(await updateMemberPermissions(member.id, draft));
  };

  const reset = async () => {
    setSaving("reset");
    finish(await resetMemberPermissions(member.id));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Access for ${member.name}`}
      description={`None hides a module, View lets them look, Manage lets them make changes. Changes apply the next time ${member.name} opens a page.`}
      className="max-w-2xl"
    >
      <form onSubmit={save} className="space-y-4">
        <div className="divide-y rounded-xl border max-h-[55vh] overflow-y-auto">
          {PERMISSION_MODULES.map((module) => {
            const level = draft[module.key];
            const labelId = `access-${module.key}`;
            return (
              <div
                key={module.key}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p id={labelId} className="text-sm font-medium">
                    {module.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {level === "none"
                      ? "No access"
                      : level === "view"
                        ? module.view
                        : module.manage}
                    {level !== defaults[module.key] && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        · {roleName} default:{" "}
                        {LEVEL_LABELS[defaults[module.key]]}
                      </span>
                    )}
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby={labelId}
                  className="inline-flex self-start rounded-lg border bg-muted/40 p-0.5 sm:self-auto"
                >
                  {moduleLevels(module.key).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "inline-flex h-7 cursor-pointer items-center rounded-md px-3 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500",
                        level === option
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name={labelId}
                        value={option}
                        checked={level === option}
                        onChange={() =>
                          setDraft((d) => ({ ...d, [module.key]: option }))
                        }
                        className="sr-only"
                      />
                      {LEVEL_LABELS[option]}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {problem && (
          <p role="alert" className="text-xs text-red-500">
            {problem}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
          <button
            type="button"
            onClick={reset}
            disabled={saving !== null || !member.customized}
            title={
              member.customized
                ? undefined
                : `${member.name} already has the ${roleName} defaults`
            }
            className="h-9 px-3 text-sm text-violet-700 dark:text-violet-300 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-2 self-start"
          >
            {saving === "reset" && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            Use {roleName} defaults
          </button>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving !== null || Boolean(problem)}
              className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {saving === "save" && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Save access
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
