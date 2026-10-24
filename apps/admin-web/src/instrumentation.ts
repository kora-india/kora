import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Missing settings are reported at start-up, not at first use (sec 9).
    const { reportEnvironment } = await import("./env");
    reportEnvironment();

    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { syncSuperAdminFromEnv } = await import("./lib/super-admin-sync");
      // Not awaited: starting the server shouldn't wait on the database.
      void syncSuperAdminFromEnv();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
