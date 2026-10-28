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

/** A school admin with no school yet: the only kind of user allowed to create one. */
async function createOnboardingAdmin() {
  const user = await prisma.user.create({
    data: {
      email: `admin-${runId}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: "irrelevant-hash",
      name: "Onboarding Admin",
      role: "SCHOOL_ADMIN",
    },
  });
  return user.id;
}

function signInAs(id: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId: null, role: "SCHOOL_ADMIN" },
  } as any);
}

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
    name: `Test School ${runId} ${currentRunId}`,
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
  beforeAll(() => {
    process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;
  });

  // Each test gets its own admin: once an admin has a school, S5 rightly
  // refuses to let them create another.
  beforeEach(async () => {
    userId = await createOnboardingAdmin();
    signInAs(userId);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { contains: runId } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.subscriptionOrder.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { schoolId: null },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.school.deleteMany({ where: { name: { contains: runId } } });
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

    // S3: onboarding must not create any extra login (the old seed added a
    // shared-password "admin.<subdomain>@schoolos.com" admin to every school).
    const schoolUsers = await prisma.user.findMany({
      where: { schoolId: body.schoolId },
      select: { id: true },
    });
    expect(schoolUsers.map((u) => u.id)).toEqual([userId]);

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
    expect(order!.status).toBe("COMPLETED");
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

  it("rejects a duplicate school ID", async () => {
    const first = await signedPayload({ subdomain: "dup-" + runId });
    expect((await POST(makeRequest(first))).status).toBe(200);

    // A different admin tries to take the same subdomain.
    userId = await createOnboardingAdmin();
    signInAs(userId);
    const second = await signedPayload({ subdomain: "dup-" + runId });
    const res = await POST(makeRequest(second));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/school ID is taken/i);
    // U3: the second admin's payment is recorded, not lost.
    expect(body.paymentSaved).toBe(true);

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
        email: `teacher-${runId}-${Math.random().toString(36).substring(7)}@example.com`,
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
  });

  it("S5: rejects school creation when user already belongs to a school", async () => {
    const existingSchool = await prisma.school.create({
      data: {
        name: `Existing School ${runId}`,
        subdomain: `existing-${runId}`,
      },
    });
    const userWithSchool = await prisma.user.create({
      data: {
        email: `attached-${runId}-${Math.random().toString(36).substring(7)}@example.com`,
        password: "hash",
        name: "Attached Admin",
        role: "SCHOOL_ADMIN",
        schoolId: existingSchool.id,
      },
    });

    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: userWithSchool.id,
        schoolId: existingSchool.id,
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
    // Their existing school is untouched.
    const after = await prisma.user.findUnique({
      where: { id: userWithSchool.id },
    });
    expect(after?.schoolId).toBe(existingSchool.id);
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
    expect(body.error).toMatch(/payment order is for plan BASIC/i);
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

  // U3: a payment that couldn't create a school is kept and reused.
  it("lets a paid admin finish with another subdomain using the same payment", async () => {
    const taken = await signedPayload({ subdomain: "held-" + runId });
    expect((await POST(makeRequest(taken))).status).toBe(200);

    userId = await createOnboardingAdmin();
    signInAs(userId);
    const paid = await signedPayload({ subdomain: "held-" + runId });
    const first = await POST(makeRequest(paid));
    expect(first.status).toBe(409);

    const order = await prisma.subscriptionOrder.findUnique({
      where: { orderId: paid.razorpay_order_id },
    });
    expect(order).toMatchObject({
      status: "PAID",
      paymentId: paid.razorpay_payment_id,
      schoolId: null,
    });

    const retry = await POST(
      makeRequest({ ...paid, subdomain: "held-retry-" + runId }),
    );
    const body = await retry.json();
    expect(retry.status).toBe(200);
    const done = await prisma.subscriptionOrder.findUnique({
      where: { orderId: paid.razorpay_order_id },
    });
    expect(done).toMatchObject({
      status: "COMPLETED",
      schoolId: body.schoolId,
    });
  }, 60000);

  it("won't reuse a saved payment with a different payment id", async () => {
    const paid = await signedPayload({
      subdomain: "reuse-" + runId,
      orderStatus: "PAID",
    });
    await prisma.subscriptionOrder.update({
      where: { orderId: paid.razorpay_order_id },
      data: { paymentId: "pay_someone_else_" + runId },
    });
    const res = await POST(makeRequest(paid));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already been consumed/i);
  });

  it("refuses another admin's subdomain while their checkout is open", async () => {
    const holder = await createOnboardingAdmin();
    await prisma.subscriptionOrder.create({
      data: {
        orderId: "order_hold_" + runId,
        userId: holder,
        plan: "PRO",
        amount: 199900,
        purpose: "SETUP",
        subdomain: "checkout-" + runId,
      },
    });
    const payload = await signedPayload({ subdomain: "checkout-" + runId });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(409);
  });

  // U2: the advertised trial.
  it("starts a 14-day trial with every feature and no payment", async () => {
    const res = await POST(
      makeRequest({
        name: `Trial School ${runId}`,
        subdomain: "trial-" + runId,
        phone: "9999999999",
        email: `trial-${runId}@example.com`,
        plan: "BASIC",
        trial: true,
        timezone: "Asia/Kolkata (IST)",
        gradingSystem: "Percentage (0 - 100)",
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);

    const school = await prisma.school.findUniqueOrThrow({
      where: { id: body.schoolId },
      include: { subscription: true },
    });
    expect(school.plan).toBe("PRO");
    expect(school.timezone).toBe("Asia/Kolkata");
    expect(school.gradingSystem).toBeNull();
    expect(school.subscription?.status).toBe("TRIAL");
    const days =
      (school.subscription!.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  }, 60000);

  it("requires payment details unless it is a trial", async () => {
    const res = await POST(
      makeRequest({
        name: `Unpaid School ${runId}`,
        subdomain: "unpaid-" + runId,
        phone: "9999999999",
        email: `unpaid-${runId}@example.com`,
        plan: "PRO",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/payment details/i);
  });

  it("creates catalogue classes in catalogue order", async () => {
    const payload = await signedPayload({ subdomain: "classes-" + runId });
    const res = await POST(
      makeRequest({ ...payload, classes: ["Nursery", "UKG", "Grade 2"] }),
    );
    const { schoolId } = await res.json();
    const classes = await prisma.class.findMany({
      where: { schoolId },
      orderBy: { grade: "asc" },
      select: { name: true, grade: true },
    });
    expect(classes).toEqual([
      { name: "Nursery", grade: -2 },
      { name: "UKG", grade: 0 },
      { name: "Grade 2", grade: 2 },
    ]);
  }, 60000);
});
