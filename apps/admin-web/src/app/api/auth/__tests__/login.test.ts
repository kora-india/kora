import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// This suite exercises the real NextAuth credentials `authorize()` logic, so
// it needs to bypass the global `@schoolos/auth` mock set up in
// `src/test/setup.ts` for every other test file.
vi.unmock('@schoolos/auth');

import { authConfig } from '@schoolos/auth';
import { prisma } from '@schoolos/db';
import bcrypt from 'bcryptjs';

// NextAuth v5's `Credentials()` factory normalizes the provider it returns:
// the top-level `authorize` on the provider object is a no-op stub, and the
// real function we passed in ends up under `.options.authorize` (that's what
// next-auth's internal request pipeline actually calls). Grab that one.
const credentialsProvider = authConfig.providers[0] as unknown as {
  options: {
    authorize: (credentials: Record<string, unknown>, request: Request) => Promise<any>;
  };
};
const authorize = credentialsProvider.options.authorize;

const email = 'login-' + Math.random().toString(36).substring(7) + '@example.com';
const password = 'correct-password-123';
const dummyRequest = new Request('http://localhost');

describe('NextAuth Credentials authorize()', () => {
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: 'Login Test User', role: 'SCHOOL_ADMIN' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it('authorizes with the correct email and password', async () => {
    const result = await authorize({ email, password }, dummyRequest);

    expect(result).toBeDefined();
    expect(result.id).toBe(userId);
    expect(result.role).toBe('SCHOOL_ADMIN');
    // Fresh registration: schoolId is null until the user completes school setup.
    expect(result.schoolId).toBeNull();
  });

  it('rejects an incorrect password', async () => {
    const result = await authorize({ email, password: 'wrong-password' }, dummyRequest);
    expect(result).toBeNull();
  });

  it('rejects a non-existent email', async () => {
    const result = await authorize(
      { email: 'nobody-' + Math.random().toString(36).substring(7) + '@example.com', password },
      dummyRequest
    );
    expect(result).toBeNull();
  });

  it('rejects a deactivated user even with the correct password', async () => {
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

    const result = await authorize({ email, password }, dummyRequest);
    expect(result).toBeNull();

    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
  });

  it('rejects when email or password is missing', async () => {
    expect(await authorize({ email }, dummyRequest)).toBeNull();
    expect(await authorize({ password }, dummyRequest)).toBeNull();
    expect(await authorize({}, dummyRequest)).toBeNull();
  });
});
