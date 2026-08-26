import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@schoolos/logger";

export interface ActionContext {
  schoolId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  [key: string]: unknown;
}

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

/**
 * Wraps a Server Action with structured performance logging and Sentry error tracking
 */
export async function safeAction<T>(
  actionName: string,
  handler: () => Promise<T>,
  context: ActionContext = {}
): Promise<ActionResponse<T>> {
  const start = performance.now();
  const actionLogger = createLogger("server-action", {
    action: actionName,
    ...context,
  });

  try {
    const result = await handler();
    const duration = Math.round(performance.now() - start);
    actionLogger.info({ durationMs: duration }, `[Action Success] ${actionName}`);
    return { success: true, data: result };
  } catch (err: unknown) {
    const duration = Math.round(performance.now() - start);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";

    // Structured logging with Pino
    actionLogger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        durationMs: duration,
      },
      `[Action Error] ${actionName}: ${errorMessage}`
    );

    // Capture exception in Sentry with tenant and user tags
    Sentry.withScope((scope) => {
      scope.setTag("action", actionName);
      if (context.schoolId) scope.setTag("schoolId", context.schoolId);
      if (context.userId) {
        scope.setUser({ id: context.userId, role: String(context.userRole ?? "") });
      }
      scope.setExtra("context", context);
      if (err instanceof Error) {
        Sentry.captureException(err);
      } else {
        Sentry.captureMessage(String(err));
      }
    });

    return { success: false, error: errorMessage };
  }
}
