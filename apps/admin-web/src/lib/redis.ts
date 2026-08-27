import { Redis } from "@upstash/redis";
import { createLogger } from "@schoolos/logger";

const redisLogger = createLogger("redis");

// Initialize the Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "https://fake.upstash.io",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "fake_token",
});

/**
 * Smart caching wrapper.
 * Checks Redis first. If miss, calls the fetcher and caches the result.
 */
export async function getCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  // Try getting from cache
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      redisLogger.debug({ key, hit: true }, `[Cache Hit] ${key}`);
      return cached;
    }
  } catch (error) {
    redisLogger.warn({ key, err: error }, `[Redis Get Error] Key: ${key}`);
  }

  // Cache miss - fetch fresh data
  redisLogger.debug({ key, hit: false }, `[Cache Miss] ${key}`);
  const data = await fetcher();

  // Store in cache
  try {
    if (data !== null && data !== undefined) {
      await redis.set(key, data, { ex: ttlSeconds });
    }
  } catch (error) {
    redisLogger.warn({ key, err: error }, `[Redis Set Error] Key: ${key}`);
  }

  return data;
}

/**
 * Smart cache invalidation.
 * Scans and deletes all keys matching a specific pattern.
 * e.g., 'cache:sch_123:students:*'
 */
export async function invalidateCache(pattern: string) {
  try {
    if (!pattern.includes("*")) {
      await redis.del(pattern);
      redisLogger.debug({ pattern }, `[Cache Invalidation] Direct key deleted: ${pattern}`);
      return;
    }

    let cursor: string | number = 0;
    let totalDeleted = 0;

    do {
      const [newCursor, keys] = (await redis.scan(cursor, { match: pattern, count: 100 })) as [
        string | number,
        string[],
      ];
      cursor = newCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== 0 && cursor !== "0");

    redisLogger.info(
      { pattern, totalDeleted },
      `[Cache Invalidation] Pattern: ${pattern} - Deleted ${totalDeleted} keys`
    );
  } catch (error) {
    redisLogger.error({ pattern, err: error }, `[Redis Invalidation Error] Pattern: ${pattern}`);
  }
}

export async function invalidateFeesCache(schoolId: string) {
  await Promise.all([
    invalidateCache(`cache:${schoolId}:feeCharges:*`),
    invalidateCache(`cache:${schoolId}:transactions:*`),
    invalidateCache(`cache:${schoolId}:academicSessions:*`),
    invalidateCache(`cache:${schoolId}:feeComponents:*`),
    invalidateCache(`cache:${schoolId}:feeStructures:*`),
    invalidateCache(`cache:${schoolId}:students:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
    invalidateCache("cache:superadmin:dashboard"),
    invalidateCache("cache:superadmin:analytics"),
  ]);
}
