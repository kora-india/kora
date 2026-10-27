"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ShieldCheck, UserX } from "lucide-react";
import { cn } from "@schoolos/utils";
import {
  PERMISSION_MODULES,
  UserRole,
  type Permissions,
  type StaffRole,
} from "@schoolos/types";
import { SettingsCard } from "@/components/settings/settings-card";
import { useConfirm } from "@/components/ui/use-confirm";
import { removeAccountant } from "@/lib/actions/team";
import { MemberAccessDialog } from "./member-access-dialog";
import { AddAccountantDialog } from "./add-accountant-dialog";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: Permissions;
  /** False while the role's defaults apply. */
  customized: boolean;
}

const ROLE_BADGES: Record<StaffRole, { label: string; className: string }> = {
  [UserRole.TEACHER]: {
    label: "Teacher",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  [UserRole.ACCOUNTANT]: {
    label: "Accountant",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
};

const labelsAt = (permissions: Permissions, level: "view" | "manage") =>
  PERMISSION_MODULES.filter((m) => permissions[m.key] === level).map(
    (m) => m.label,
  );

/** Settings → Team & access, for school admins. */
export function TeamAccessContent({
  members,
}: Readonly<{ members: TeamMember[] }>) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [adding, setAdding] = useState(false);

  const remove = async (member: TeamMember) => {
    const confirmed = await confirm({
      title: `Remove ${member.name}'s login?`,
      description:
        "They won't be able to sign in. Adding an accountant with the same email brings the login back.",
      confirmLabel: "Remove login",
      variant: "danger",
    });
    if (!confirmed) return;
    const result = await removeAccountant(member.id);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  return (
    <>
      {confirmDialog}
      <SettingsCard
        title="Team & access"
        description="Choose what each teacher and accountant can see and change. School admins always have full access."
        action={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex flex-shrink-0 items-center gap-1.5 h-8 px-3 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add accountant
          </button>
        }
      >
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teacher or accountant logins yet. Teachers get one when you add
            them in Teachers &amp; Staff; add accountants here.
          </p>
        ) : (
          <ul className="divide-y -my-2">
            {members.map((member) => {
              const manage = labelsAt(member.permissions, "manage");
              const view = labelsAt(member.permissions, "view");
              const badge = ROLE_BADGES[member.role];
              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{member.name}</p>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {member.customized ? "Custom access" : "Role defaults"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {manage.length === 0 && view.length === 0
                        ? "No access to any module"
                        : [
                            manage.length && `Can change: ${manage.join(", ")}`,
                            view.length && `Can see: ${view.join(", ")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(member)}
                      aria-label={`Edit access for ${member.name}`}
                      className="flex items-center gap-1.5 h-8 px-3 border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Edit access
                    </button>
                    {member.role === UserRole.ACCOUNTANT && (
                      <button
                        type="button"
                        onClick={() => remove(member)}
                        aria-label={`Remove login for ${member.name}`}
                        className="flex items-center gap-1.5 h-8 px-3 border rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      {editing && (
        <MemberAccessDialog
          member={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
      {adding && (
        <AddAccountantDialog
          open
          onOpenChange={(open) => !open && setAdding(false)}
        />
      )}
    </>
  );
}
