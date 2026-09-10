import { ShieldOff, Mail } from "lucide-react";
import { signOut } from "next-auth/react";

export const metadata = { title: "Account Suspended — Kora" };

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-5">
        <ShieldOff className="w-7 h-7 text-red-600 dark:text-red-400" />
      </div>

      <h1 className="text-xl font-bold mb-2">Account Suspended</h1>
      <p className="text-sm text-muted-foreground mb-1 max-w-sm">
        Your school account has been temporarily suspended.
      </p>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm">
        Please contact Kora support to resolve this issue.
      </p>

      <div className="bg-muted/40 border rounded-xl p-4 mb-6 max-w-xs w-full">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Support
        </p>
        <div className="flex items-center justify-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-violet-600" />
          <a
            href="mailto:support@kora.app"
            className="text-violet-600 hover:underline font-medium"
          >
            support@kora.app
          </a>
        </div>
      </div>

      <form
        action={async () => {
          "use server";
          const { signOut: serverSignOut } = await import("@schoolos/auth");
          await serverSignOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="h-9 px-5 border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
