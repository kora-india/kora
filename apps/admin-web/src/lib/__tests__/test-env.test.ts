import { describe, expect, it } from "vitest";

/**
 * Prisma Client loads the real .env files when it starts. test/setup.ts
 * blanks their settings first, so tests never run with live keys and can't
 * call Gemini, Razorpay, Cloudinary or a real database by accident.
 */
describe("test environment", () => {
  it("keeps live service keys out after the database client loads", async () => {
    const { prisma } = await import("@schoolos/db");
    await prisma.$connect();
    for (const key of [
      "GEMINI_API_KEY",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "CLOUDINARY_API_SECRET",
      "UPSTASH_REDIS_REST_TOKEN",
      "BACKUP_DATABASE_URL",
    ]) {
      // Only whether it's set, so a failure never prints a real key.
      expect(Boolean(process.env[key]), `${key} is set`).toBe(false);
    }
    const db = new URL(process.env.DATABASE_URL ?? "");
    expect(["localhost", "127.0.0.1"], "test database host").toContain(
      db.hostname,
    );
  });
});
