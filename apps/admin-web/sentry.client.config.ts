import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Adjust tracesSampleRate in production as necessary
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    // Enable Replay only if configured
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Filter out noisy client-side noise
    ignoreErrors: [
      "ResizeObserver loop completed with undelivered notifications",
      "Network request failed",
    ],
  });
}
