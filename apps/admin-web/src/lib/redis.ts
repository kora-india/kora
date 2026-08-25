import { Redis } from '@upstash/redis';

// Initialize the Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Smart caching wrapper.
 * Checks Redis first. If miss, calls the fetcher and caches the result.
 */
export async function getCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // Try getting from cache
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      console.log(`[Cache Hit] ${key}`);
      return cached;
    }
  } catch (error) {
    console.warn(`[Redis Get Error] Key: ${key}`, error);
  }

  // Cache miss - fetch fresh data
  console.log(`[Cache Miss] ${key} - Fetching fresh data`);
  const data = await fetcher();

  // Store in cache
  try {
    if (data !== null && data !== undefined) {
      await redis.set(key, data, { ex: ttlSeconds });
    }
  } catch (error) {
    console.warn(`[Redis Set Error] Key: ${key}`, error);
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
    if (!pattern.includes('*')) {
      await redis.del(pattern);
      console.log(`[Cache Invalidation] Direct key deleted: ${pattern}`);
      return;
    }

    let cursor: string | number = 0;
    let totalDeleted = 0;
    
    do {
      // scan returns [new_cursor, keys]
      const [newCursor, keys] = (await redis.scan(cursor, { match: pattern, count: 100 })) as [string | number, string[]];
      cursor = newCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== 0 && cursor !== "0");

    console.log(`[Cache Invalidation] Pattern: ${pattern} - Deleted ${totalDeleted} keys`);
  } catch (error) {
    console.error(`[Redis Invalidation Error] Pattern: ${pattern}`, error);
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
    invalidateCache(`cache:${schoolId}:classes:*`),
    invalidateCache(`cache:${schoolId}:school:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
  ]);
}

