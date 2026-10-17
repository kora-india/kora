import { describe, it, expect, beforeEach, vi } from "vitest";

// Unmock @/lib/redis so we test the actual caching logic and memory fallback
vi.unmock("@/lib/redis");

import {
  getCache,
  invalidateCache,
  invalidateFeesCache,
  invalidateLedgerCache,
  invalidateStudentsCache,
  invalidateTeachersCache,
  invalidateSuperAdminCache,
} from "../redis";

describe("Redis & In-Memory Cache System", () => {
  beforeEach(async () => {
    // Invalidate all test keys before each test
    await invalidateCache("test:*");
  });

  it("should return fresh data on cache miss and cache it for subsequent calls", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { id: 1, name: "Horizon School" };
    };

    const first = await getCache("test:school:1", fetcher, 60);
    expect(first).toEqual({ id: 1, name: "Horizon School" });
    expect(callCount).toBe(1);

    const second = await getCache("test:school:1", fetcher, 60);
    expect(second).toEqual({ id: 1, name: "Horizon School" });
    expect(callCount).toBe(1); // Cached, fetcher not called again
  });

  it("should ensure identical serializable types on miss and hit (C5)", async () => {
    const testDate = new Date("2026-04-01T10:00:00.000Z");
    const fetcher = async () => ({
      date: testDate,
      count: 42,
    });

    // Cache miss returns JSON-serialized clone
    const miss = await getCache("test:dates:1", fetcher, 60);
    // Cache hit returns stored JSON
    const hit = await getCache("test:dates:1", fetcher, 60);

    expect(typeof miss.date).toBe("string");
    expect(typeof hit.date).toBe("string");
    expect(miss.date).toBe(hit.date);
    expect(miss).toEqual(hit);
  });

  it("should NOT cache error results (C4)", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { error: "Route not found" };
    };

    const first = await getCache("test:error:1", fetcher, 60);
    expect(first).toEqual({ error: "Route not found" });
    expect(callCount).toBe(1);

    // Second call should still invoke fetcher because error result was not cached
    const second = await getCache("test:error:1", fetcher, 60);
    expect(second).toEqual({ error: "Route not found" });
    expect(callCount).toBe(2);
  });

  it("should invalidate specific key directly", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { count: callCount };
    };

    await getCache("test:item:1", fetcher, 60);
    expect(callCount).toBe(1);

    await invalidateCache("test:item:1");

    await getCache("test:item:1", fetcher, 60);
    expect(callCount).toBe(2);
  });

  it("should invalidate wildcard pattern matching", async () => {
    let fetchA = 0;
    let fetchB = 0;

    await getCache("test:classes:basic", async () => ++fetchA, 60);
    await getCache("test:classes:withSections", async () => ++fetchB, 60);
    expect(fetchA).toBe(1);
    expect(fetchB).toBe(1);

    await invalidateCache("test:classes:*");

    await getCache("test:classes:basic", async () => ++fetchA, 60);
    await getCache("test:classes:withSections", async () => ++fetchB, 60);
    expect(fetchA).toBe(2);
    expect(fetchB).toBe(2);
  });

  it("should support helper invalidation functions", async () => {
    await expect(invalidateFeesCache("sch_test")).resolves.not.toThrow();
    await expect(invalidateLedgerCache("sch_test")).resolves.not.toThrow();
    await expect(invalidateStudentsCache("sch_test")).resolves.not.toThrow();
    await expect(invalidateTeachersCache("sch_test")).resolves.not.toThrow();
    await expect(invalidateSuperAdminCache()).resolves.not.toThrow();
  });
});
