import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { POST } from '../route';
import { prisma } from '@schoolos/db';

const testEmail = 'register-' + Math.random().toString(36).substring(7) + '@example.com';
const validPassword = 'correct-password-123';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function createOtp(overrides: Partial<{ otp: string; expiresAt: Date }> = {}) {
  return prisma.otp.create({
    data: {
      email: testEmail,
      otp: overrides.otp ?? '123456',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await prisma.otp.deleteMany({ where: { email: testEmail } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    await prisma.otp.deleteMany({ where: { email: testEmail } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  it('registers a new user with a valid OTP and hashes the password', async () => {
    await createOtp();

    const res = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '123456' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(testEmail);
    expect(body.user.password).toBeUndefined(); // never leak the password/hash back

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeDefined();
    expect(user!.role).toBe('SCHOOL_ADMIN');
    expect(user!.password).not.toBe(validPassword);
    await expect(bcrypt.compare(validPassword, user!.password)).resolves.toBe(true);
  });

  it('consumes the OTP so it cannot be reused for a second registration', async () => {
    await createOtp();
    await POST(makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '123456' }));

    const otpAfter = await prisma.otp.findFirst({ where: { email: testEmail } });
    expect(otpAfter).toBeNull();

    // Simulate a second request replaying the same (now-consumed) OTP for a different email
    // that happens to reuse the code — should fail since no matching Otp row exists.
    await prisma.user.deleteMany({ where: { email: testEmail } });
    const res = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '123456' })
    );
    expect(res.status).toBe(400);
  });

  it('rejects an incorrect OTP', async () => {
    await createOtp({ otp: '111111' });

    const res = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '999999' })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid otp/i);
  });

  it('rejects an expired OTP', async () => {
    await createOtp({ expiresAt: new Date(Date.now() - 60 * 1000) });

    const res = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '123456' })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/expired/i);
  });

  it('rejects registration when the email is already registered', async () => {
    await createOtp();
    await prisma.user.create({
      data: { email: testEmail, password: 'irrelevant-hash', name: 'Existing', role: 'SCHOOL_ADMIN' },
    });

    const res = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '123456' })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already registered/i);
  });

  it('rejects malformed input (short password, bad email, wrong-length OTP)', async () => {
    await createOtp();

    const shortPassword = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: '123', otp: '123456' })
    );
    expect(shortPassword.status).toBe(400);

    const badEmail = await POST(
      makeRequest({ name: 'Test User', email: 'not-an-email', password: validPassword, otp: '123456' })
    );
    expect(badEmail.status).toBe(400);

    const badOtpLength = await POST(
      makeRequest({ name: 'Test User', email: testEmail, password: validPassword, otp: '123' })
    );
    expect(badOtpLength.status).toBe(400);
  });
});
