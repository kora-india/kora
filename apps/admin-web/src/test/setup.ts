import { vi } from "vitest";
import dotenv from "dotenv";
import path from "path";

// Load .env.test if present (local test config kept out of git)
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// Ensure safe test database fallback (prevents accidental production connection)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:password@localhost:5432/schoolos_test?schema=public";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

// Set default test SMTP variables
process.env.SMTP_HOST = process.env.SMTP_HOST || "smtp.test.example.com";
process.env.SMTP_PORT = process.env.SMTP_PORT || "587";
process.env.SMTP_USER = process.env.SMTP_USER || "test-smtp-user";
process.env.SMTP_PASSWORD = process.env.SMTP_PASSWORD || "test-smtp-pass";

// Mock Next.js Cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Auth
vi.mock("@schoolos/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: "test-user-id",
        schoolId: "test-school-id",
        role: "SUPER_ADMIN",
      },
    }),
  ),
}));

// Mock Redis Cache
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  },
  getCache: vi.fn(async (_key: string, fetcher: () => Promise<any>) =>
    fetcher(),
  ),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
  invalidateFeesCache: vi.fn().mockResolvedValue(undefined),
  invalidateLedgerCache: vi.fn().mockResolvedValue(undefined),
  invalidateStudentsCache: vi.fn().mockResolvedValue(undefined),
  invalidateClassesCache: vi.fn().mockResolvedValue(undefined),
  invalidateTeachersCache: vi.fn().mockResolvedValue(undefined),
  invalidateDashboardCache: vi.fn().mockResolvedValue(undefined),
  invalidateTransportCache: vi.fn().mockResolvedValue(undefined),
  invalidateSuperAdminCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock Ratelimiting: every limiter allows every request.
vi.mock("@/lib/ratelimit", () => {
  const allowAll = () => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 0,
    }),
  });
  return {
    otpRatelimit: allowAll(),
    otpIpRatelimit: allowAll(),
    passwordResetRatelimit: allowAll(),
    authRatelimit: allowAll(),
    paymentRatelimit: allowAll(),
    subdomainRatelimit: allowAll(),
    schoolCreateRatelimit: allowAll(),
    apiRatelimit: allowAll(),
    uploadRatelimit: allowAll(),
    createRateLimitResponse: vi.fn(),
  };
});

// Mock Nodemailer (prevent real emails from being sent during tests).
// Tests that need to assert on send behavior can import `nodemailer` and use
// `vi.mocked(...)` against these same mock functions.
vi.mock("nodemailer", () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "test-message-id" });
  const createTransport = vi.fn(() => ({ sendMail }));
  return {
    default: { createTransport },
    createTransport,
  };
});
