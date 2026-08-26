import { PrismaClient, Prisma } from "@prisma/client";
import { createLogger } from "@schoolos/logger";

declare global {
  var __prisma: PrismaClient | undefined;
}

const dbLogger = createLogger("prisma");

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  // Log slow queries (>200ms) to identify bottlenecks early
  (client as any).$on("query", (e: Prisma.QueryEvent) => {
    if (e.duration >= 200) {
      dbLogger.warn(
        {
          durationMs: e.duration,
          target: e.target,
          query: e.query,
          params: e.params,
        },
        `[Slow Query] ${e.duration}ms: ${e.query.slice(0, 120)}`
      );
    } else if (process.env.LOG_ALL_QUERIES === "true") {
      dbLogger.debug({ durationMs: e.duration, query: e.query }, `Prisma Query (${e.duration}ms)`);
    }
  });

  (client as any).$on("error", (e: Prisma.LogEvent) => {
    dbLogger.error({ target: e.target, message: e.message }, "[Prisma Database Error]");
  });

  (client as any).$on("warn", (e: Prisma.LogEvent) => {
    dbLogger.warn({ target: e.target, message: e.message }, "[Prisma Database Warning]");
  });

  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalThis.__prisma || (prop === "staff" && !("staff" in globalThis.__prisma))) {
      globalThis.__prisma = createPrismaClient();
    }
    const client = globalThis.__prisma as any;
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export * from "@prisma/client";
