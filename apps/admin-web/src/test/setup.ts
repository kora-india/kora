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
  invalidateFeesCache: vi.fn(),
}));
