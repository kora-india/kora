"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import { createAccountant } from "@/lib/actions/team";

/**
 * Adds an accountant login with the accountant defaults, then shows its
 * temporary password once. Mount it when it opens.
 */
export function AddAccountantDialog({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{
    tempPassword: string;
    reactivated: boolean;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createAccountant(form);
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCreated({
      tempPassword: result.tempPassword,
      reactivated: result.reactivated,
    });
    router.refresh();
  };

  if (created) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          created.reactivated ? "Accountant login restored" : "Accountant added"
        }
        description={`Share these details with ${form.name} securely. They get the accountant defaults; change them with Edit access.`}
      >
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                Email
              </p>
              <p className="text-sm font-medium">
                {form.email.trim().toLowerCase()}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                Temporary password
              </p>
              <div className="flex items-center justify-between">
                <p
                  className="text-sm font-mono font-semibold"
                  data-testid="temp-password"
                >
                  {showPassword ? created.tempPassword : "••••••••••••"}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Copy temporary password"
                    onClick={() => {
                      navigator.clipboard.writeText(created.tempPassword);
                      toast.success("Password copied!");
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            Save this password now. It won&apos;t be shown again. They should
            change it after signing in.
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-9 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Done
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add accountant"
      description="Creates a login with a temporary password. Accountants start with Fees, Expenses, Ledger and Transport, and can see students."
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Full name" htmlFor="accountant-name" required>
          <input
            id="accountant-name"
            value={form.name}
            onChange={set("name")}
            required
            minLength={2}
            maxLength={100}
            className={inputCls}
          />
        </FormField>
        <FormField label="Email" htmlFor="accountant-email" required>
          <input
            id="accountant-email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            className={inputCls}
          />
        </FormField>
        <FormField label="Phone" htmlFor="accountant-phone">
          <input
            id="accountant-phone"
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            maxLength={20}
            className={inputCls}
          />
        </FormField>
        <div className="flex gap-2 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create login
          </button>
        </div>
      </form>
    </Dialog>
  );
}
