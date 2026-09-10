import Link from "next/link";
import { Clock, ShieldCheck, Mail, ArrowRight, Sparkles } from "lucide-react";
import { signOut } from "@schoolos/auth";

export const metadata = { title: "Subscription Expired — Kora" };

export default function ExpiredPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center py-12">
      <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-6 shadow-sm">
        <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>

      <h1 className="text-2xl font-bold mb-2 tracking-tight">
        Your Subscription Has Expired
      </h1>

      <p className="text-sm text-muted-foreground mb-2 max-w-md">
        Your trial or subscription period has concluded. Renew your plan to
        restore full administrative access.
      </p>

      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs px-3.5 py-1.5 rounded-full my-4">
        <ShieldCheck className="w-4 h-4" />
        <span>
          All your students, classes, and fee records remain safely preserved.
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 mb-8">
        <Link
          href="/subscriptions"
          className="h-11 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Choose a Plan & Renew
          <ArrowRight className="w-4 h-4" />
        </Link>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="h-11 px-5 border rounded-xl text-sm hover:bg-muted transition-colors text-muted-foreground font-medium"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="bg-muted/40 border rounded-2xl p-4 max-w-sm w-full">
        <p className="text-xs font-semibold text-muted-foreground mb-1">
          Need help or a custom quote?
        </p>
        <div className="flex items-center justify-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-violet-600" />
          <a
            href="mailto:billing@kora.app"
            className="text-violet-600 hover:underline font-medium"
          >
            billing@kora.app
          </a>
        </div>
      </div>
    </div>
  );
}
