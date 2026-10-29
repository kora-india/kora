import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";
import { createLogger } from "@schoolos/logger";
import { NextResponse } from "next/server";

const rateLimitLogger = createLogger("rate-limit");

const isRedisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN) &&
  !process.env.UPSTASH_REDIS_REST_URL?.includes("fake.upstash.io");

// Without Upstash each server instance counts on its own and forgets on a
// cold start, so in production the limits barely hold (sec 9). Say so loudly.
if (process.env.NODE_ENV === "production" && !isRedisConfigured) {
  rateLimitLogger.error(
    "UPSTASH_REDIS_REST_URL/TOKEN are not set: rate limits are per server instance and reset on cold starts, so they don't protect login, OTP or payment endpoints",
  );
}

/**
 * In-memory fixed-window fallback for development. Each limiter keeps its
 * own counts (they used to share one map, so login attempts counted against
 * the payment limit), and expired entries are dropped as it grows.
 */
function createInMemoryLimiter(maxRequests: number, windowSeconds: number) {
  const memoryStore = new Map<string, { count: number; resetAt: number }>();
  return {
    async limit(identifier: string) {
      const now = Date.now();
      if (memoryStore.size > 10_000) {
        for (const [key, entry] of memoryStore) {
          if (now > entry.resetAt) memoryStore.delete(key);
        }
      }
      const record = memoryStore.get(identifier);

      if (!record || now > record.resetAt) {
        memoryStore.set(identifier, {
          count: 1,
          resetAt: now + windowSeconds * 1000,
        });
        return {
          success: true,
          limit: maxRequests,
          remaining: maxRequests - 1,
          reset: now + windowSeconds * 1000,
        };
      }

      if (record.count < maxRequests) {
        record.count += 1;
        return {
          success: true,
          limit: maxRequests,
          remaining: maxRequests - record.count,
          reset: record.resetAt,
        };
      }

      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: record.resetAt,
      };
    },
  };
}

/**
 * File uploads (sec 9): 20 per 10 minutes per user.
 */
export const uploadRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 m"),
      analytics: true,
      prefix: "ratelimit:upload",
    })
  : createInMemoryLimiter(20, 600);

/**
 * Gemini calls (they cost money): 20 per 10 minutes per user.
 */
export const aiRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 m"),
      analytics: true,
      prefix: "ratelimit:ai",
    })
  : createInMemoryLimiter(20, 600);

/**
 * OTP Dispatch Rate Limiter: Max 3 requests per 10 minutes per Email
 */
export const otpRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      analytics: true,
      prefix: "ratelimit:otp:email",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(3, 600);

/**
 * OTP IP Limiter: Max 10 requests per 10 minutes per IP (prevents spray attacks)
 */
export const otpIpRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      analytics: true,
      prefix: "ratelimit:otp:ip",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(10, 600);

/**
 * Password Reset Rate Limiter: Max 3 requests per 15 minutes per IP or Email
 */
export const passwordResetRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "15 m"),
      analytics: true,
      prefix: "ratelimit:pw-reset",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(3, 900);

/**
 * Auth Rate Limiter (Registration/Login): Max 5 requests per 15 minutes per IP
 */
export const authRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "ratelimit:auth",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(5, 900);

/**
 * Payment Orders Rate Limiter: Max 10 order attempts per minute
 */
export const paymentRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "ratelimit:payment",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(10, 60);

/**
 * Subdomain Probing Rate Limiter: Max 20 checks per minute per IP
 */
export const subdomainRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
      prefix: "ratelimit:subdomain",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(20, 60);

/**
 * Tenant Creation Rate Limiter: Max 5 school setups per hour per user/IP
 */
export const schoolCreateRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      analytics: true,
      prefix: "ratelimit:school-create",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(5, 3600);

/**
 * General API Route Limiter: Max 100 requests per minute
 */
export const apiRatelimit = isRedisConfigured
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "ratelimit:api",
      ephemeralCache: new Map(),
    })
  : createInMemoryLimiter(100, 60);

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Creates standard HTTP 429 Too Many Requests response with RFC rate limit headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string,
): NextResponse {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000),
  );
  const message =
    customMessage ||
    `Too many requests. Please slow down and try again in ${retryAfterSeconds} seconds.`;

  rateLimitLogger.warn(
    {
      limit: result.limit,
      remaining: result.remaining,
      retryAfterSeconds,
    },
    `[Rate Limit Exceeded] Blocked request: ${message}`,
  );

  return NextResponse.json(
    {
      error: message,
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    },
  );
}
