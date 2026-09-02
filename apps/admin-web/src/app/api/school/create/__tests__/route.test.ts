import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { POST } from '../route';
import { prisma } from '@schoolos/db';
import { auth } from '@schoolos/auth';

const RAZORPAY_SECRET = 'test-razorpay-secret';
const runId = Math.random().toString(36).substring(7);
let userId: string;

function signedPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const orderId = 'order_' + runId;
  const paymentId = 'pay_' + runId;
  const signature = crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(orderId + '|' + paymentId)
    .digest('hex');

  return {
    name: 'Test School ' + runId,
    subdomain: 'school-' + runId,
    phone: '9999999999',
    email: `owner-${runId}@example.com`,
    plan: 'PRO',
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/school/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/school/create', () => {
  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;

    const user = await prisma.user.create({
      data: {
        email: `admin-${runId}@example.com`,
        password: 'irrelevant-hash',
        name: 'Onboarding Admin',
        role: 'SCHOOL_ADMIN',
      },
    });
    userId = user.id;
  });

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: userId, schoolId: null, role: 'SCHOOL_ADMIN' },
    } as any);
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { school: { name: { contains: runId } } } });
    await prisma.school.deleteMany({ where: { name: { contains: runId } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('creates the school + subscription and links the user in one transaction', async () => {
    const payload = signedPayload();

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const school = await prisma.school.findUnique({ where: { id: body.schoolId } });
    expect(school).toBeDefined();
    expect(school!.subdomain).toBe(payload.subdomain);
    expect(school!.plan).toBe('PRO');

    const subscription = await prisma.subscription.findUnique({ where: { schoolId: body.schoolId } });
    expect(subscription).toBeDefined();
    expect(subscription!.status).toBe('ACTIVE');
    expect(subscription!.currentPeriodEnd!.getTime()).toBeGreaterThan(subscription!.currentPeriodStart!.getTime());

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.schoolId).toBe(body.schoolId);
  });

  it('rejects a tampered Razorpay signature and writes nothing to the database', async () => {
    const payload = signedPayload({
      subdomain: 'tampered-' + runId,
      razorpay_signature: 'not-the-real-signature',
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/payment verification failed|invalid payment signature/i);

    const school = await prisma.school.findUnique({ where: { subdomain: payload.subdomain } });
    expect(school).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const res = await POST(makeRequest(signedPayload({ subdomain: 'unauth-' + runId })));
    expect(res.status).toBe(401);
  });

  it('rejects a duplicate subdomain', async () => {
    const first = signedPayload({ subdomain: 'dup-' + runId });
    await POST(makeRequest(first));

    const second = signedPayload({ subdomain: 'dup-' + runId });
    const res = await POST(makeRequest(second));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already taken/i);

    // Only one Subscription should exist for that subdomain's school, not two.
    const school = await prisma.school.findUnique({ where: { subdomain: first.subdomain } });
    const subscriptions = await prisma.subscription.findMany({ where: { schoolId: school!.id } });
    expect(subscriptions).toHaveLength(1);
  });

  it('rolls back the School row if the transaction fails partway through', async () => {
    // A session whose user id does not exist in the DB makes tx.user.update()
    // fail after the School (and Subscription) rows have already been created
    // inside the same transaction — this verifies they get rolled back rather
    // than left as orphaned rows.
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'non-existent-user-id', schoolId: null, role: 'SCHOOL_ADMIN' },
    } as any);

    const payload = signedPayload({ subdomain: 'rollback-' + runId });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(500);

    const school = await prisma.school.findUnique({ where: { subdomain: payload.subdomain } });
    expect(school).toBeNull();
  });

  it('rejects a plan value outside the allowed enum', async () => {
    const res = await POST(makeRequest(signedPayload({ subdomain: 'badplan-' + runId, plan: 'ULTRA' })));
    expect(res.status).toBe(400);
  });
});
