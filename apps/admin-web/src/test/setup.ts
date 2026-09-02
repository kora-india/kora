import { vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Set default test SMTP variables
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.test.example.com';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.SMTP_USER = process.env.SMTP_USER || 'test-smtp-user';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'test-smtp-pass';

// Mock Next.js Cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock Auth
vi.mock('@schoolos/auth', () => ({
  auth: vi.fn(() => Promise.resolve({
    user: {
      id: 'test-user-id',
      schoolId: 'test-school-id',
      role: 'SUPER_ADMIN',
    },
  })),
}));

// Mock Redis Cache
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  },
  getCache: vi.fn(async (_key: string, fetcher: () => Promise<any>) => fetcher()),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
  invalidateFeesCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock Ratelimiting
vi.mock('@/lib/ratelimit', () => ({
  otpRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }) },
  authRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }) },
  paymentRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }) },
  subdomainRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }) },
  schoolCreateRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }) },
  apiRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }) },
  createRateLimitResponse: vi.fn(),
}));

// Mock Nodemailer (prevent real emails from being sent during tests).
// Tests that need to assert on send behavior can import `nodemailer` and use
// `vi.mocked(...)` against these same mock functions.
vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
  const createTransport = vi.fn(() => ({ sendMail }));
  return {
    default: { createTransport },
    createTransport,
  };
});

