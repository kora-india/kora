type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(data && { data }),
  };

  if (process.env.NODE_ENV === "production") {
    // Structured JSON for log aggregators (Vercel, Datadog, etc.)
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  } else {
    const prefix = { info: "ℹ️", warn: "⚠️", error: "🔴", debug: "🔍" }[level];
    console[level === "debug" ? "log" : level](`${prefix} [${entry.timestamp}] ${message}`, data ?? "");
  }
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") log("debug", message, data);
  },
};
