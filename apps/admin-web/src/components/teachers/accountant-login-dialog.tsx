"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff } from "lucide-react";
import { LoginEmailNotice } from "@/components/auth/login-email-notice";
import { Dialog } from "@/components/ui/dialog";
import type { AccountantLogin } from "@/lib/accountant-login";

/** Shows a new accountant's sign-in details, once. */
export function AccountantLoginDialog({
  open,
  onOpenChange,
  name,
  email,
  login,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  email: string;
  login: AccountantLogin;
}>) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        login.reactivated ? "Accountant login restored" : "Accountant added"
      }
      description={`${login.emailed ? `We've emailed ${name} these details.` : `Share these details with ${name} securely.`} They get the accountant defaults; change them in Settings → Team & Access.`}
    >
      <div className="space-y-4">
        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Email
            </p>
            <p className="text-sm font-medium">{email}</p>
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
                {showPassword ? login.tempPassword : "••••••••••••"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                    navigator.clipboard.writeText(login.tempPassword);
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
        <LoginEmailNotice emailed={login.emailed} email={email} />
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
