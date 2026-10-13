import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import crypto from "crypto";
import { POST } from "../route";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";

const RAZORPAY_SECRET = "test-razorpay-secret";
const runId = Math.random().toString(36).substring(7);
let userId: string;

async function signedPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const currentRunId = Math.random().toString(36).substring(7);
  const orderId =
    (overrides.razorpay_order_id as string) || "order_" + currentRunId;
  const paymentId =
    (overrides.razorpay_payment_id as string) || "pay_" + currentRunId;
  const plan = (overrides.plan as any) || "PRO";
  const signature =
    (overrides.razorpay_signature as string) ||
    crypto
      .createHmac("sha256", RAZORPAY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

  if (overrides.skipOrder !== true) {
    await prisma.subscriptionOrder.create({
      data: {
        orderId,
        userId: (overrides.orderUserId as string) || userId,
        plan: (overrides.orderPlan as any) || (plan === "ULTRA" ? "PRO" : plan),
        amount: 199900,
        currency: "INR",
        status: (overrides.orderStatus as string) || "PENDING",
      },
    });
  }

  const { skipOrder, orderUserId, orderPlan, orderStatus, ...cleanOverrides } =
    overrides;

  return {
    name: "Test School " + currentRunId,
    subdomain: "school-" + currentRunId,
    phone: "9999999999",
    email: `owner-${currentRunId}@example.com`,
    plan,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    ...cleanOverrides,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/school/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/school/create", () => {
  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;

    const user = await prisma.user.create({
      data: {
        email: `admin-${runId}@example.com`,
        password: "irrelevant-hash",
        name: "Onboarding Admin",
        role: "SCHOOL_ADMIN",
      },
    });
    userId = user.id;
  });

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: userId, schoolId: null, role: "SCHOOL_ADMIN" },
    } as any);
  });

  afterAll(async () => {
    await prisma.subscriptionOrder.deleteMany({
      where: { userId },
    });
    await prisma.subscription.deleteMany({
      where: { school: { name: { contains: runId } } },
    });
    await prisma.school.deleteMany({ where: { name: { contains: runId } } });
    await prisma.user.deleteMany({
      where: {
        OR: [{ id: userId }, { email: { contains: runId } }],
      },
    });
  });

  it("creates the school + subscription, links the user, and prepopulates starter data in one transaction", async () => {
    const payload = await signedPayload();

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const school = await prisma.school.findUnique({
      where: { id: body.schoolId },
    });
    expect(school).toBeDefined();
    expect(school!.subdomain).toBe(payload.subdomain);
    expect(school!.plan).toBe("PRO");

    const subscription = await prisma.subscription.findUnique({
      where: { schoolId: body.schoolId },
    });
    expect(subscription).toBeDefined();
    expect(subscription!.status).toBe("ACTIVE");
    expect(subscription!.currentPeriodEnd!.getTime()).toBeGreaterThan(
      subscription!.currentPeriodStart!.getTime(),
    );

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.schoolId).toBe(body.schoolId);

    // Verify prepopulated data
    const classes = await prisma.class.findMany({
      where: { schoolId: body.schoolId },
    });
    expect(classes.length).toBeGreaterThanOrEqual(1);

    const students = await prisma.student.findMany({
      where: { schoolId: body.schoolId },
    });
    expect(students.length).toBeGreaterThanOrEqual(1);

    const teachers = await prisma.teacher.findMany({
      where: { schoolId: body.schoolId },
    });
    expect(teachers.length).toBeGreaterThanOrEqual(1);

    const feeComponents = await prisma.feeComponent.findMany({
      where: { schoolId: body.schoolId },
    });
    expect(feeComponents.length).toBeGreaterThanOrEqual(5);

    const feeStructures = await prisma.feeStructure.findMany({
      where: { schoolId: body.schoolId },
    });
    expect(feeStructures.length).toBeGreaterThanOrEqual(1);

    // Verify order is marked paid and tied to school
    const order = await prisma.subscriptionOrder.findUnique({
      where: { orderId: payload.razorpay_order_id },
    });
    expect(order!.status).toBe("PAID");
    expect(order!.paymentId).toBe(payload.razorpay_payment_id);
    expect(order!.schoolId).toBe(body.schoolId);
  }, 60000);

  it("rejects a tampered Razorpay signature and writes nothing to the database", async () => {
    const payload = await signedPayload({
      subdomain: "tampered-" + runId,
      razorpay_signature: "not-the-real-signature",
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(
      /payment verification failed|invalid payment signature/i,
    );

    const school = await prisma.school.findUnique({
      where: { subdomain: payload.subdomain },
    });
    expect(school).toBeNull();
  });

  it("rejects an unauthenticated request", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const payload = await signedPayload({ subdomain: "unauth-" + runId });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(401);
  });

  it("rejects a duplicate subdomain", async () => {
    const first = await signedPayload({ subdomain: "dup-" + runId });
    await POST(makeRequest(first));

    const second = await signedPayload({ subdomain: "dup-" + runId });
    const res = await POST(makeRequest(second));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already taken/i);

    // Only one Subscription should exist for that subdomain's school, not two.
    const school = await prisma.school.findUnique({
      where: { subdomain: first.subdomain },
    });
    const subscriptions = await prisma.subscription.findMany({
      where: { schoolId: school!.id },
    });
    expect(subscriptions).toHaveLength(1);
  }, 60000);

  it("rejects a plan value outside the allowed enum", async () => {
    const payload = await signedPayload({
      subdomain: "badplan-" + runId,
      plan: "ULTRA",
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });

  it("S5: rejects school creation when user has non-SCHOOL_ADMIN role", async () => {
    const teacherUser = await prisma.user.create({
      data: {
        email: `teacher-${Math.random().toString(36).substring(7)}@example.com`,
        password: "hash",
        name: "Teacher User",
        role: "TEACHER",
      },
    });

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: teacherUser.id, schoolId: null, role: "TEACHER" },
    } as any);

    const payload = await signedPayload({
      userId: teacherUser.id,
      subdomain: "teacher-try-" + runId,
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/only school admins/i);

    await prisma.user.delete({ where: { id: teacherUser.id } });
  });

  it("S5: rejects school creation when user already belongs to a school", async () => {
    const userWithSchool = await prisma.user.create({
      data: {
        email: `attached-${Math.random().toString(36).substring(7)}@example.com`,
        password: "hash",
        name: "Attached Admin",
        role: "SCHOOL_ADMIN",
        schoolId: "some-existing-school-id",
      },
    });

    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: userWithSchool.id,
        schoolId: "some-existing-school-id",
        role: "SCHOOL_ADMIN",
      },
    } as any);

    const payload = await signedPayload({
      userId: userWithSchool.id,
      subdomain: "attached-try-" + runId,
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already belongs/i);

    await prisma.user.delete({ where: { id: userWithSchool.id } });
  });

  it("S4: rejects school creation when payment order does not exist in DB", async () => {
    const payload = await signedPayload({
      subdomain: "no-order-" + runId,
      skipOrder: true,
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/order not found/i);
  });

  it("S4: rejects school creation when order plan does not match requested plan", async () => {
    const payload = await signedPayload({
      subdomain: "plan-mismatch-" + runId,
      orderPlan: "BASIC",
      plan: "ENTERPRISE",
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/plan mismatch/i);
  });

  it("S4: rejects school creation when order has already been consumed", async () => {
    const payload = await signedPayload({
      subdomain: "already-used-" + runId,
      orderStatus: "PAID",
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already been consumed/i);
  });

  it("S4: rejects school creation when order belongs to a different user", async () => {
    const payload = await signedPayload({
      subdomain: "other-user-" + runId,
      orderUserId: "different-user-id",
    });

    const res = await POST(makeRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/does not belong to caller/i);
  });

  it("S4: fails closed when RAZORPAY_KEY_SECRET is missing", async () => {
    const origSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    try {
      const payload = await signedPayload({
        subdomain: "no-secret-" + runId,
      });

      const res = await POST(makeRequest(payload));
      expect(res.status).toBe(500);
    } finally {
      process.env.RAZORPAY_KEY_SECRET = origSecret;
    }
  });
});
