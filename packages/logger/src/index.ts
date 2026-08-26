import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const isDev = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

const SENSITIVE_KEYS = [
  "password",
  "tempPassword",
  "token",
  "otp",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "*.password",
  "*.tempPassword",
  "*.token",
  "*.otp",
];

const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  redact: {
    paths: SENSITIVE_KEYS,
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV || "development",
    service: "schoolos",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && !isTest
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname,env,service",
            translateTime: "HH:MM:ss.l",
          },
        },
      }
    : {}),
};

export const logger = pino(pinoConfig);

/**
 * Creates a child logger scoped to a specific application module
 */
export function createLogger(moduleName: string, context: Record<string, unknown> = {}) {
  return logger.child({ module: moduleName, ...context });
}

/**
 * Creates a child logger pre-configured with tenant (school) and user metadata
 */
export function createTenantLogger(
  schoolId: string | null | undefined,
  moduleName?: string,
  context: Record<string, unknown> = {}
) {
  return logger.child({
    schoolId: schoolId ?? "platform",
    ...(moduleName ? { module: moduleName } : {}),
    ...context,
  });
}

/**
 * Safely format and log any error (Error object, string, or unknown)
 */
export function logError(
  err: unknown,
  message = "An unhandled exception occurred",
  context: Record<string, unknown> = {}
) {
  if (err instanceof Error) {
    logger.error(
      {
        err: {
          name: err.name,
          message: err.message,
          stack: err.stack,
        },
        ...context,
      },
      message
    );
  } else {
    logger.error({ err, ...context }, message);
  }
}

export default logger;
