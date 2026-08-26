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
  browser: {
    asObject: true,
  },
};

// In-process dev stream for pretty terminal output without worker_threads or Webpack/Turbopack bundling issues
const devPrettyStream = {
  write(str: string) {
    try {
      const log = JSON.parse(str);
      const time = log.time ? new Date(log.time).toLocaleTimeString() : "";
      const levelMap: Record<number, string> = {
        10: "\x1b[90mTRACE\x1b[0m",
        20: "\x1b[34mDEBUG\x1b[0m",
        30: "\x1b[32mINFO\x1b[0m ",
        40: "\x1b[33mWARN\x1b[0m ",
        50: "\x1b[31mERROR\x1b[0m",
        60: "\x1b[35mFATAL\x1b[0m",
      };
      const lvl = levelMap[log.level] || "LOG";
      const mod = log.module ? `\x1b[36m[${log.module}]\x1b[0m ` : "";
      const msg = log.msg || "";
      delete log.time;
      delete log.level;
      delete log.msg;
      delete log.pid;
      delete log.hostname;
      delete log.env;
      delete log.service;
      delete log.module;
      const extra = Object.keys(log).length > 0 ? ` \x1b[90m${JSON.stringify(log)}\x1b[0m` : "";
      if (typeof process !== "undefined" && process.stdout?.write) {
        process.stdout.write(`[${time}] ${lvl} ${mod}${msg}${extra}\n`);
      } else {
        console.log(`[${time}] ${lvl} ${mod}${msg}${extra}`);
      }
    } catch {
      if (typeof process !== "undefined" && process.stdout?.write) {
        process.stdout.write(str);
      } else {
        console.log(str);
      }
    }
  },
};

function createRootLogger(): pino.Logger {
  if (isDev && !isTest && typeof window === "undefined") {
    return pino(pinoConfig, devPrettyStream);
  }
  return pino(pinoConfig);
}

export const logger = createRootLogger();

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
