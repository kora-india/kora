import { vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

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
