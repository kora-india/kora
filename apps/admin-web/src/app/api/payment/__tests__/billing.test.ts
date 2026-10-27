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

const { createRazorpayOrder } = vi.hoisted(() => ({
  createRazorpayOrder: vi.fn(),
}));
vi.mock("razorpay", () => ({
  default: class {
    orders = { create: createRazorpayOrder };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { POST as createOrder } from "../create-order/route";
import { POST as verify } from "../verify/route";
import { addOneMonth, nextPaidPeriod } from "@/lib/billing";
import { DEFAULT_PLANS } from "@/lib/plans";

const SECRET = "test-razorpay-secret";
const run = Math.random().toString(36).slice(2, 8);
const schoolId = `billing-school-${run}`;
let adminId: string;
let newAdminId: string;

const json = (body: unknown) =>
  new Request("http://localhost/api/payment", {
    method: "POST",
    body: JSON.stringify(body),
  });

const signAs = (id: string, school: string | null) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId: school, role: "SCHOOL_ADMIN" },
  } as any);

const sign = (orderId: string, paymentId: string) =>
  crypto
    .createHmac("sha256", SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

describe("billing periods", () => {
  it("adds a calendar month, keeping to the month's last day", () => {
    expect(addOneMonth(new Date("2026-01-31T10:00:00Z")).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
    expect(addOneMonth(new Date("2026-10-21T10:00:00Z")).toISOString()).toBe(
      "2026-11-21T10:00:00.000Z",
    );
  });

  it("extends a paid month and keeps a trial's remaining days", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const later = new Date("2026-10-30T00:00:00Z");
    expect(
      nextPaidPeriod({ status: "ACTIVE", currentPeriodEnd: later }, now),
    ).toMatchObject({
      start: later,
      extended: true,
    });
    expect(
      nextPaidPeriod({ status: "TRIAL", trialEndsAt: later }, now).start,
    ).toEqual(later);
    // Lapsed: starts today.
    expect(
      nextPaidPeriod(
        { status: "ACTIVE", currentPeriodEnd: new Date("2026-10-01") },
        now,
      ).start,
    ).toEqual(now);
  });
});

describe("subscription payments", () => {
  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    await prisma.school.create({
      data: {
        id: schoolId,
        name: `Billing School ${run}`,
        subdomain: `billing-${run}`,
        plan: "PRO",
        subscription: {
          create: {
            plan: "PRO",
            status: "TRIAL",
            trialEndsAt: new Date(Date.now() + 5 * 86_400_000),
          },
        },
      },
    });
    adminId = (
      await prisma.user.create({
        data: {
          email: `billing-admin-${run}@example.com`,
          password: "x",
          name: "Admin",
          role: "SCHOOL_ADMIN",
          schoolId,
        },
      })
    ).id;
    newAdminId = (
      await prisma.user.create({
        data: {
          email: `billing-new-${run}@example.com`,
          password: "x",
          name: "New Admin",
          role: "SCHOOL_ADMIN",
        },
      })
    ).id;
  });

  beforeEach(() => {
    createRazorpayOrder.mockImplementation(async (opts: any) => ({
      id: `order_${run}_${Math.random().toString(36).slice(2, 8)}`,
      amount: opts.amount,
      currency: "INR",
    }));
  });

  afterAll(async () => {
    await prisma.subscriptionOrder.deleteMany({
      where: { userId: { in: [adminId, newAdminId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, newAdminId] } },
    });
    await purgeSchool(prisma, schoolId);
  });

  it("charges the catalogue price", async () => {
    signAs(adminId, schoolId);
    const res = await createOrder(json({ plan: "BASIC", purpose: "RENEWAL" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.amount).toBe(DEFAULT_PLANS.BASIC.monthlyPriceInr * 100);
    const order = await prisma.subscriptionOrder.findUniqueOrThrow({
      where: { orderId: body.orderId },
    });
    expect(order).toMatchObject({ purpose: "RENEWAL", schoolId });
  });

  it("holds a setup subdomain and refuses one that is taken", async () => {
    signAs(newAdminId, null);
    const taken = await createOrder(
      json({ plan: "PRO", subdomain: `billing-${run}` }),
    );
    expect(taken.status).toBe(409);

    const res = await createOrder(
      json({ plan: "PRO", subdomain: `fresh-${run}` }),
    );
    const { orderId } = await res.json();
    const order = await prisma.subscriptionOrder.findUniqueOrThrow({
      where: { orderId },
    });
    expect(order).toMatchObject({
      purpose: "SETUP",
      subdomain: `fresh-${run}`,
      schoolId: null,
    });
  });

  it("turns a trial into a paid plan, starting when the trial ends", async () => {
    signAs(adminId, schoolId);
    const { orderId } = await (
      await createOrder(json({ plan: "BASIC", purpose: "RENEWAL" }))
    ).json();
    const before = await prisma.subscription.findUniqueOrThrow({
      where: { schoolId },
    });

    const paymentId = `pay_${run}_trial`;
    const payload = {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId),
    };
    const res = await verify(json(payload));
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { schoolId },
    });
    expect(sub).toMatchObject({
      status: "ACTIVE",
      plan: "BASIC",
      trialEndsAt: null,
    });
    expect(sub.currentPeriodEnd).toEqual(addOneMonth(before.trialEndsAt!));
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
    });
    expect(school.plan).toBe("BASIC");

    // The same payment again changes nothing.
    const again = await verify(json(payload));
    expect((await again.json()).alreadyApplied).toBe(true);
    const unchanged = await prisma.subscription.findUniqueOrThrow({
      where: { schoolId },
    });
    expect(unchanged.currentPeriodEnd).toEqual(sub.currentPeriodEnd);
  });

  it("adds the next month after the paid one", async () => {
    signAs(adminId, schoolId);
    const before = await prisma.subscription.findUniqueOrThrow({
      where: { schoolId },
    });
    const { orderId } = await (
      await createOrder(json({ plan: "PRO", purpose: "RENEWAL" }))
    ).json();
    const paymentId = `pay_${run}_renew`;
    await verify(
      json({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
      }),
    );
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { schoolId },
    });
    expect(sub.plan).toBe("PRO");
    expect(sub.currentPeriodEnd).toEqual(addOneMonth(before.currentPeriodEnd!));
  });

  it("rejects a tampered signature and someone else's order", async () => {
    signAs(adminId, schoolId);
    const { orderId } = await (
      await createOrder(json({ plan: "PRO", purpose: "RENEWAL" }))
    ).json();
    const bad = await verify(
      json({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_x",
        razorpay_signature: "0".repeat(64),
      }),
    );
    expect(bad.status).toBe(400);

    signAs(newAdminId, null);
    const notMine = await verify(
      json({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_y",
        razorpay_signature: sign(orderId, "pay_y"),
      }),
    );
    expect(notMine.status).toBe(400);
  });
});
