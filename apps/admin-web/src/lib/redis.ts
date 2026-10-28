import { Redis } from "@upstash/redis";
import { createLogger } from "@schoolos/logger";

const redisLogger = createLogger("redis");

// C6: Check if a real Upstash Redis instance is configured
export const isRedisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN) &&
  !process.env.UPSTASH_REDIS_REST_URL?.includes("fake.upstash.io") &&
  !process.env.UPSTASH_REDIS_REST_TOKEN?.includes("fake_token");

// Initialize the Upstash Redis client
export const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : new Redis({
      url: "https://fake.upstash.io",
      token: "fake_token",
    });

// C6: In-memory cache fallback for local/dev/desktop mode when Upstash is not configured
interface MemoryCacheEntry {
  data: string;
  expiresAt: number;
}
// One cache for the whole server process. Next.js can load this module more
// than once (server actions and page rendering get separate copies), and a
// cache per copy meant a change saved by an action never cleared what pages
// had cached, so pages stayed stale until the entry expired.
const globalForCache = globalThis as typeof globalThis & {
  __koraMemoryCache?: Map<string, MemoryCacheEntry>;
};
const memoryCache = (globalForCache.__koraMemoryCache ??= new Map());

/**
 * Smart caching wrapper.
 * Checks Redis (or memory cache fallback) first. If miss, calls the fetcher and caches the result.
 */
export async function getCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600,
): Promise<T> {
  const now = Date.now();

  // C6: If Redis is not configured, use local memory cache directly without hitting network
  if (!isRedisConfigured) {
    const entry = memoryCache.get(key);
    if (entry && now < entry.expiresAt) {
      redisLogger.debug(
        { key, hit: true, backend: "memory" },
        `[Memory Cache Hit] ${key}`,
      );
      return JSON.parse(entry.data) as T;
    }

    redisLogger.debug(
      { key, hit: false, backend: "memory" },
      `[Memory Cache Miss] ${key}`,
    );
    const data = await fetcher();

    // C4: Do not cache error results
    const isError =
      data &&
      typeof data === "object" &&
      "error" in (data as Record<string, any>) &&
      Boolean((data as any).error);

    if (data !== null && data !== undefined && !isError) {
      // C5: Ensure JSON-serialized consistency on miss and hit
      const serialized = JSON.stringify(data);
      memoryCache.set(key, {
        data: serialized,
        expiresAt: now + ttlSeconds * 1000,
      });
      return JSON.parse(serialized) as T;
    }

    return data;
  }

  // Try getting from Upstash Redis
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      redisLogger.debug(
        { key, hit: true, backend: "redis" },
        `[Cache Hit] ${key}`,
      );
      return cached;
    }
  } catch (error) {
    redisLogger.warn({ key, err: error }, `[Redis Get Error] Key: ${key}`);
  }

  // Cache miss - fetch fresh data
  redisLogger.debug(
    { key, hit: false, backend: "redis" },
    `[Cache Miss] ${key}`,
  );
  const data = await fetcher();

  // C4: Do not cache error results
  const isError =
    data &&
    typeof data === "object" &&
    "error" in (data as Record<string, any>) &&
    Boolean((data as any).error);

  // Store in cache
  if (data !== null && data !== undefined && !isError) {
    // C5: Normalize to JSON-serialized structure so miss matches hit
    const serialized = JSON.parse(JSON.stringify(data));
    try {
      await redis.set(key, serialized, { ex: ttlSeconds });
    } catch (error) {
      redisLogger.warn({ key, err: error }, `[Redis Set Error] Key: ${key}`);
    }
    return serialized as T;
  }

  return data;
}

/**
 * Smart cache invalidation.
 * Scans and deletes all keys matching a specific pattern.
 * e.g., 'cache:sch_123:students:*'
 */
export async function invalidateCache(pattern: string) {
  // Always invalidate memory cache keys
  if (!pattern.includes("*")) {
    memoryCache.delete(pattern);
  } else {
    const regexPattern =
      "^" +
      pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
      "$";
    const regex = new RegExp(regexPattern);
    for (const k of Array.from(memoryCache.keys())) {
      if (regex.test(k)) {
        memoryCache.delete(k);
      }
    }
  }

  if (!isRedisConfigured) {
    redisLogger.debug(
      { pattern, backend: "memory" },
      `[Memory Cache Invalidation] Pattern: ${pattern}`,
    );
    return;
  }

  try {
    if (!pattern.includes("*")) {
      await redis.del(pattern);
      redisLogger.debug(
        { pattern, backend: "redis" },
        `[Cache Invalidation] Direct key deleted: ${pattern}`,
      );
      return;
    }

    let cursor: string | number = 0;
    let totalDeleted = 0;

    do {
      const [newCursor, keys] = (await redis.scan(cursor, {
        match: pattern,
        count: 100,
      })) as [string | number, string[]];
      cursor = newCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== 0 && cursor !== "0");

    redisLogger.info(
      { pattern, totalDeleted, backend: "redis" },
      `[Cache Invalidation] Pattern: ${pattern} - Deleted ${totalDeleted} keys`,
    );
  } catch (error) {
    redisLogger.error(
      { pattern, err: error },
      `[Redis Invalidation Error] Pattern: ${pattern}`,
    );
  }
}

// C2: Invalidate fees & ledger caches
export async function invalidateFeesCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:feeCharges:*`),
    invalidateCache(`cache:${schoolId}:transactions:*`),
    invalidateCache(`cache:${schoolId}:academicSessions:*`),
    invalidateCache(`cache:${schoolId}:feeComponents:*`),
    invalidateCache(`cache:${schoolId}:feeStructures:*`),
    invalidateCache(`cache:${schoolId}:students:*`),
    invalidateCache(`cache:${schoolId}:ledger:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
    invalidateCache("cache:superadmin:dashboard"),
    invalidateCache("cache:superadmin:analytics"),
  ]);
}

// C2: Invalidate ledger keys on expense or ledger updates
export async function invalidateLedgerCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:ledger:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
  ]);
}

export async function invalidateStudentsCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:students:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
  ]);
}

export async function invalidateClassesCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:classes:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
  ]);
}

// C7: Teacher invalidation helper
export async function invalidateTeachersCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:teachers:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
  ]);
}

export async function invalidateDashboardCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
    invalidateCache("cache:superadmin:dashboard"),
    invalidateCache("cache:superadmin:analytics"),
  ]);
}

export async function invalidateTransportCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:transport:*`),
    invalidateCache(`cache:${schoolId}:students:*`),
    invalidateCache(`cache:${schoolId}:feeCharges:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
    invalidateCache("cache:superadmin:dashboard"),
    invalidateCache("cache:superadmin:analytics"),
  ]);
}

// C7: SuperAdmin cache invalidation helper
export async function invalidateSuperAdminCache() {
  await Promise.all([
    invalidateCache("cache:superadmin:*"),
    invalidateCache("cache:superadmin:dashboard"),
    invalidateCache("cache:superadmin:analytics"),
  ]);
}
