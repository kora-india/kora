"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry
    Sentry.captureException(error, {
      tags: {
        location: "dashboard-error-boundary",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
      </div>
      <h2 className="text-base font-semibold mb-1">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        We couldn&apos;t load this page. This might be a temporary issue — try again or contact support if the issue persists.
      </p>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-2 h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
      {error.digest && (
        <p className="mt-4 text-[10px] text-muted-foreground font-mono">
          Incident ID: {error.digest}
        </p>
      )}
    </div>
  );
}
