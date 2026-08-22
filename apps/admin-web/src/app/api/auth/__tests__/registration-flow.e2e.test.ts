import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { POST as sendOtp } from '../send-otp/route';
import { POST as register } from '../register/route';
import { POST as checkSubdomain } from '../../school/check-subdomain/route';
import { POST as createSchool } from '../../school/create/route';
import { prisma } from '@schoolos/db';
import { auth } from '@schoolos/auth';

// End-to-end style test chaining the real onboarding sequence:
// send-otp -> register -> (login, simulated via the auth mock) ->
// check-subdomain -> school/create. Catches regressions where one route's
// output stops matching what the next route expects.

const RAZORPAY_SECRET = 'e2e-test-razorpay-secret';
const runId = 'e2e-' + Math.random().toString(36).substring(7);
const email = `${runId}@example.com`;
const password = 'correct-password-123';
const subdomain = `school-${runId}`;

function jsonRequest(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('Full registration flow (send-otp -> register -> school/create)', () => {
  beforeAll(() => {
    process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;
  });

  afterAll(async () => {
    const school = await prisma.school.findUnique({ where: { subdomain } });
    if (school) {
      await prisma.subscription.deleteMany({ where: { schoolId: school.id } });
      await prisma.school.delete({ where: { id: school.id } });
    }
    await prisma.otp.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it('completes the whole onboarding sequence and leaves consistent final state', async () => {
    // 1. Request an OTP
    const otpRes = await sendOtp(jsonRequest('http://localhost/api/auth/send-otp', { email }));
    expect(otpRes.status).toBe(200);

    const otpRow = await prisma.otp.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
    expect(otpRow).toBeDefined();

    // 2. Register using the real OTP that was generated
    const registerRes = await register(
      jsonRequest('http://localhost/api/auth/register', {
        name: 'E2E Test Admin',
        email,
        password,
        otp: otpRow!.otp,
      })
    );
    const registerBody = await registerRes.json();
    expect(registerRes.status).toBe(200);
    expect(registerBody.success).toBe(true);

    // The OTP must be consumed — no leftover rows for this email.
    expect(await prisma.otp.findFirst({ where: { email } })).toBeNull();

    const userId = registerBody.user.id;

    // 3. "Login" — simulate the session the client would have after signIn('credentials')
    vi.mocked(auth).mockResolvedValue({
      user: { id: userId, schoolId: null, role: 'SCHOOL_ADMIN' },
    } as any);

    // 4. Check the desired subdomain is free
    const checkRes = await checkSubdomain(
      jsonRequest('http://localhost/api/school/check-subdomain', { subdomain })
    );
    const checkBody = await checkRes.json();
    expect(checkRes.status).toBe(200);
    expect(checkBody.available).toBe(true);

    // 5. Create the school (with a valid signed payment payload)
    const orderId = 'order_' + runId;
    const paymentId = 'pay_' + runId;
    const signature = crypto
      .createHmac('sha256', RAZORPAY_SECRET)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    const createRes = await createSchool(
      jsonRequest('http://localhost/api/school/create', {
        name: 'E2E Test School',
        subdomain,
        phone: '9999999999',
        email: `owner-${runId}@example.com`,
        plan: 'BASIC',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      })
    );
    const createBody = await createRes.json();
    expect(createRes.status).toBe(200);
    expect(createBody.success).toBe(true);

    // 6. Final state: user is linked to the new school, subscription is active,
    // and the subdomain is no longer available for anyone else.
    const finalUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(finalUser!.schoolId).toBe(createBody.schoolId);

    const subscription = await prisma.subscription.findUnique({
      where: { schoolId: createBody.schoolId },
    });
    expect(subscription!.status).toBe('ACTIVE');

    const recheckRes = await checkSubdomain(
      jsonRequest('http://localhost/api/school/check-subdomain', { subdomain })
    );
    const recheckBody = await recheckRes.json();
    expect(recheckBody.available).toBe(false);
  });
});
