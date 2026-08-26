import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@schoolos/logger";

type RouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse | Response>;

/**
 * Higher-order function to wrap Next.js Route Handlers with structured logging & Sentry monitoring
 */
export function withApiLogging(routeName: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: any) => {
    const start = performance.now();
    const correlationId = req.headers.get("x-request-id") || crypto.randomUUID();
    const apiLogger = createLogger("api-route", {
      route: routeName,
      method: req.method,
      url: req.nextUrl.pathname,
      requestId: correlationId,
    });

    try {
      apiLogger.info(`[API Request] ${req.method} ${req.nextUrl.pathname}`);
      const response = await handler(req, context);
      const durationMs = Math.round(performance.now() - start);

      apiLogger.info(
        {
          status: response.status,
          durationMs,
        },
        `[API Response] ${req.method} ${req.nextUrl.pathname} -> ${response.status} (${durationMs}ms)`
      );

      return response;
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = err instanceof Error ? err.message : "Internal Server Error";

      apiLogger.error(
        {
          err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
          durationMs,
        },
        `[API Error] ${req.method} ${req.nextUrl.pathname}: ${errorMessage}`
      );

      Sentry.withScope((scope) => {
        scope.setTag("api_route", routeName);
        scope.setTag("http_method", req.method);
        scope.setExtra("requestId", correlationId);
        if (err instanceof Error) {
          Sentry.captureException(err);
        } else {
          Sentry.captureMessage(String(err));
        }
      });

      return NextResponse.json(
        { error: "Internal Server Error", requestId: correlationId },
        { status: 500 }
      );
    }
  };
}
