import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { POST } from '../route';
import { prisma } from '@schoolos/db';

const testEmail = 'send-otp-' + Math.random().toString(36).substring(7) + '@example.com';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/send-otp', () => {
  beforeEach(async () => {
    await prisma.otp.deleteMany({ where: { email: testEmail } });
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.otp.deleteMany({ where: { email: testEmail } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  it('generates a 6-digit OTP, stores it with a ~10 minute expiry, and emails it', async () => {
    const before = Date.now();
    const res = await POST(makeRequest({ email: testEmail }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const otpRow = await prisma.otp.findFirst({
      where: { email: testEmail },
      orderBy: { createdAt: 'desc' },
    });
    expect(otpRow).toBeDefined();
    expect(otpRow!.otp).toMatch(/^\d{6}$/);

    const expiresInMs = otpRow!.expiresAt.getTime() - before;
    expect(expiresInMs).toBeGreaterThan(9 * 60 * 1000);
    expect(expiresInMs).toBeLessThan(11 * 60 * 1000);

    expect(nodemailer.createTransport).toHaveBeenCalled();
  });

  it('rejects when the email already belongs to a registered user', async () => {
    await prisma.user.create({
      data: {
        email: testEmail,
        password: 'irrelevant-hash',
        name: 'Existing User',
        role: 'SCHOOL_ADMIN',
      },
    });

    const res = await POST(makeRequest({ email: testEmail }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already registered/i);

    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  it('rejects an invalid email format', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('invalidates the previous OTP when a new one is requested for the same email', async () => {
    await POST(makeRequest({ email: testEmail }));
    const first = await prisma.otp.findFirst({ where: { email: testEmail } });

    await POST(makeRequest({ email: testEmail }));

    const remaining = await prisma.otp.findMany({ where: { email: testEmail } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(first!.id);
  });

  it('KNOWN GAP: leaves the OTP row in place even when the email fails to send', async () => {
    // Documents current behavior rather than desired behavior — the route writes
    // the Otp row *before* attempting delivery and never rolls it back on
    // failure, so the user ends up with an OTP they never received and can't
    // regenerate (send-otp de-dupes on the newest row, but the user has no way
    // to know it exists). Flagged in DOCUMENTATION.md's production-readiness
    // gaps; update this test once the route is fixed to clean up on failure.
    const { sendMail } = nodemailer.createTransport({} as any);
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('SMTP connection failed'));

    const res = await POST(makeRequest({ email: testEmail }));
    expect(res.status).toBe(500);

    const otpRow = await prisma.otp.findFirst({ where: { email: testEmail } });
    expect(otpRow).toBeDefined();
  });
});
