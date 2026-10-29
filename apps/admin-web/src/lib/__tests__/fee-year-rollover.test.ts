/**
 * Fees across time, against the test database: the automatic monthly job
 * billing for real (its route test fakes the billing), the start of a new
 * school year, and schools that only take full payments.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
// Next.js resolves "server-only" at build time; vitest can't.
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  // The job hands the next batch to itself after the response; not here.
  after: vi.fn(),
}));
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { GET as monthlyFeeJob } from "@/app/api/cron/generate-fees/route";
import { generateMonthlyFees } from "../actions/fee-generator";
import { createAcademicSession } from "../actions/fee-settings";
import { allocatePayment } from "../actions/fee-allocator";
import { enrollStudentTransport } from "../actions/transport";
import { getLedgerData } from "../reports/ledger";
import { DEFAULT_LEDGER_QUERY } from "../reports/ledger-query";
import {
  buildMonthList,
  firstPolicyError,
  type FeePolicy,
} from "../fees/collection";
import { todayInTimeZone } from "../fees/timezone";
import { formatPeriodLabel } from "../fees/billing-period";

const TZ = "Asia/Kolkata";
const CRON_SECRET = "rollover-cron-secret-1234567890";
const today = todayInTimeZone(TZ);
const pad = (n: number) => String(n).padStart(2, "0");
const num = (d: unknown) => Number(d ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100 + 0;

/** The month `offset` months from this one, with its first and last days. */
function monthAt(offset: number) {
  const first = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1),
  );
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  );
  const key = `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}`;
  return { key, first: iso(first), last: iso(last) };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

const runJob = (query = "") =>
  monthlyFeeJob(
    new Request(`http://localhost/api/cron/generate-fees${query}`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }),
  );

const schools: string[] = [];

/** A school with an admin signed in, one class, and `pupils` students in it. */
async function makeSchool(name: string, pupils = 3) {
  const id = `${name}-${Math.random().toString(36).slice(2, 8)}`;
  schools.push(id);
  await prisma.school.create({
    data: {
      id,
      name,
      subdomain: id,
      plan: "ENTERPRISE",
      timezone: TZ,
      autoFeeGeneration: false,
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin-${id}@rollover.test`,
      name: "Admin",
      password: "x",
      role: "SCHOOL_ADMIN",
      schoolId: id,
    },
  });
  const cls = await prisma.class.create({
    data: { schoolId: id, name: "Grade 4", grade: 4 },
  });
  const section = await prisma.section.create({
    data: { schoolId: id, classId: cls.id, name: "A" },
  });
  const students = [];
  for (let i = 1; i <= pupils; i++) {
    students.push(
      await prisma.student.create({
        data: {
          schoolId: id,
          classId: cls.id,
          sectionId: section.id,
          name: `${name} pupil ${i}`,
          rollNumber: String(i),
          admissionNumber: `${id}-${i}`,
          parentName: "Parent",
          parentPhone: "9999999999",
        },
      }),
    );
  }
  const component = (
    n: string,
    amount: number,
    frequency: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME",
  ) =>
    prisma.feeComponent.create({
      data: { schoolId: id, name: n, amount, frequency },
    });
  const fees = {
    tuition: await component("Tuition Fee", 2000, "MONTHLY"),
    exam: await component("Exam Fee", 900, "QUARTERLY"),
    annual: await component("Annual Charges", 4000, "YEARLY"),
    admission: await component("Admission Fee", 7500, "ONE_TIME"),
  };
  const signIn = () =>
    vi.mocked(auth).mockResolvedValue({
      user: { id: admin.id, schoolId: id, role: "SCHOOL_ADMIN", name: "Admin" },
    } as any);
  signIn();
  return { id, admin, cls, section, students, fees, signIn };
}
type School = Awaited<ReturnType<typeof makeSchool>>;

/** A session from month `from` to month `to` (offsets from this month). */
async function makeSession(
  school: School,
  name: string,
  from: number,
  to: number,
  isCurrent: boolean,
) {
  return prisma.academicSession.create({
    data: {
      schoolId: school.id,
      name,
      startDate: new Date(monthAt(from).first),
      endDate: new Date(monthAt(to).last),
      isCurrent,
    },
  });
}

/** The class's fee structure in `sessionId`, with tuition at `tuition`. */
async function makeStructure(
  school: School,
  sessionId: string,
  tuition: number,
) {
  const structure = await prisma.feeStructure.create({
    data: {
      schoolId: school.id,
      sessionId,
      name: `Structure ${sessionId}`,
      items: {
        create: [
          { componentId: school.fees.tuition.id, amount: tuition },
          { componentId: school.fees.exam.id },
          { componentId: school.fees.annual.id },
          { componentId: school.fees.admission.id },
        ],
      },
    },
  });
  await prisma.classFeeStructure.create({
    data: { classId: school.cls.id, structureId: structure.id },
  });
  return structure;
}

/** Each student's charges, as { "YYYY-MM": { component: amount } }. */
async function billsOf(studentId: string) {
  const charges = await prisma.feeCharge.findMany({
    where: { studentId },
    include: { items: { include: { component: true } } },
    orderBy: { dueDate: "asc" },
  });
  return charges.map((c) => ({
    period: c.periodKey,
    sessionId: c.sessionId,
    items: Object.fromEntries(
      c.items.map((i) => [i.component.name, num(i.amount)]),
    ),
  }));
}

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
});

afterAll(async () => {
  for (const id of schools) await purgeSchool(prisma, id);
});

// ─── The automatic monthly job ──────────────────────────────────────────────

describe("the automatic monthly fee job", () => {
  let school: School;

  beforeAll(async () => {
    school = await makeSchool("Auto");
    const session = await makeSession(school, "This year", -2, 9, true);
    await makeStructure(school, session.id, 2000);
    await prisma.school.update({
      where: { id: school.id },
      data: { autoFeeGeneration: true },
    });
  });

  it("bills this month, due on the 10th, and marks the school done", async () => {
    const res = await runJob(`?schoolId=${school.id}`);
    expect(res.status).toBe(200);
    const thisMonth = monthAt(0).key;

    for (const student of school.students) {
      const bills = await billsOf(student.id);
      expect(bills).toHaveLength(1);
      expect(bills[0].period).toBe(thisMonth);
      // Its first bill of the session: everything that starts the year.
      expect(bills[0].items).toEqual({
        "Tuition Fee": 2000,
        "Exam Fee": 900,
        "Annual Charges": 4000,
        "Admission Fee": 7500,
      });
    }
    const charge = await prisma.feeCharge.findFirstOrThrow({
      where: { studentId: school.students[0].id },
    });
    expect(iso(charge.dueDate)).toBe(`${thisMonth}-10`);
    expect(charge.title).toBe(formatPeriodLabel(thisMonth));
    expect(
      (await prisma.school.findUniqueOrThrow({ where: { id: school.id } }))
        .lastAutoFeePeriod,
    ).toBe(thisMonth);
  });

  it("bills nobody twice: on its next run, or forced, or after staff billed by hand", async () => {
    signInFor(school);
    await runJob();
    await runJob(`?schoolId=${school.id}`);
    const manual = await generateMonthlyFees(
      (await prisma.academicSession.findFirstOrThrow({
        where: { schoolId: school.id },
      }))!.id,
      [school.cls.id],
      "",
      `${monthAt(0).key}-10`,
      monthAt(0).key,
    );
    expect(manual).toMatchObject({
      generatedCount: 0,
      alreadyGeneratedCount: 3,
    });
    expect(
      await prisma.feeCharge.count({ where: { schoolId: school.id } }),
    ).toBe(3);
  });

  it("leaves alone a school that turned it off", async () => {
    const off = await makeSchool("Manual");
    const session = await makeSession(off, "This year", -2, 9, true);
    await makeStructure(off, session.id, 2000);
    await runJob();
    expect(await prisma.feeCharge.count({ where: { schoolId: off.id } })).toBe(
      0,
    );
  });
});

function signInFor(school: School) {
  school.signIn();
}

// ─── A new school year ──────────────────────────────────────────────────────

describe("a new school year", () => {
  let school: School;
  let lastYear: { id: string };
  let thisYear: { id: string };

  beforeAll(async () => {
    school = await makeSchool("Rollover", 2);
    // Last year ended last month; its final two months were billed.
    lastYear = await makeSession(school, "Last year", -12, -1, true);
    await makeStructure(school, lastYear.id, 2000);
    for (const offset of [-2, -1]) {
      const res = await generateMonthlyFees(
        lastYear.id,
        [school.cls.id],
        "",
        `${monthAt(offset).key}-10`,
        monthAt(offset).key,
      );
      expect(res).toMatchObject({ generatedCount: 2 });
    }
    // Pupil 1 rides the bus, and paid ahead: 1,000 in advance.
    const route = await prisma.transportRoute.create({
      data: {
        schoolId: school.id,
        name: "East",
        startPoint: "Depot",
        endPoint: "School",
        stops: { create: [{ stopName: "Mill", sequenceOrder: 1 }] },
      },
      include: { stops: true },
    });
    await enrollStudentTransport({
      studentId: school.students[0].id,
      routeId: route.id,
      stopId: route.stops[0].id,
      distanceKm: 3,
      monthlyFee: 700,
    } as any);
    const advance = await allocatePayment({
      studentId: school.students[0].id,
      generalAdvanceAmount: 1000,
      method: "UPI",
    });
    expect(advance).toMatchObject({ success: true });
  });

  it("makes the new session current and the old one not", async () => {
    signInFor(school);
    const res = await createAcademicSession({
      name: "This year",
      startDate: monthAt(0).first,
      endDate: monthAt(11).last,
      isCurrent: true,
    });
    expect(res).toEqual({ success: true });
    thisYear = await prisma.academicSession.findFirstOrThrow({
      where: { schoolId: school.id, name: "This year" },
    });
    const sessions = await prisma.academicSession.findMany({
      where: { schoolId: school.id },
      orderBy: { startDate: "asc" },
    });
    expect(sessions.map((s) => [s.name, s.isCurrent])).toEqual([
      ["Last year", false],
      ["This year", true],
    ]);
  });

  it("bills the new year's first month: yearly fees again, one-time fees never, advance used", async () => {
    signInFor(school);
    // Fees go up: a new structure for the new session.
    await makeStructure(school, thisYear.id, 2300);
    const res = await generateMonthlyFees(
      thisYear.id,
      [school.cls.id],
      "",
      `${monthAt(0).key}-10`,
      monthAt(0).key,
    );
    expect(res).toMatchObject({ generatedCount: 2 });

    const [rider, other] = await Promise.all(
      school.students.map((s) => billsOf(s.id)),
    );
    const firstMonth = (bills: typeof rider) =>
      bills.find((b) => b.period === monthAt(0).key)!;
    expect(firstMonth(other).items).toEqual({
      "Tuition Fee": 2300,
      "Exam Fee": 900,
      "Annual Charges": 4000,
    });
    expect(firstMonth(other).sessionId).toBe(thisYear.id);

    // The bus rider keeps the bus into the new year, at the same fee.
    expect(firstMonth(rider).items).toEqual({
      "Tuition Fee": 2300,
      "Exam Fee": 900,
      "Annual Charges": 4000,
      "Transport Fee": 700,
    });
    expect(
      await prisma.studentTransport.findMany({
        where: { studentId: school.students[0].id },
        select: { sessionId: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
    ).toEqual([
      { sessionId: lastYear.id, status: "ACTIVE" },
      { sessionId: thisYear.id, status: "ACTIVE" },
    ]);

    // Last year's advance paid towards it.
    const settlements = await prisma.paymentTransaction.findMany({
      where: { studentId: school.students[0].id, status: "ADJUSTMENT" },
    });
    expect(settlements.map((s) => num(s.amount))).toEqual([1000]);
  });

  it("keeps last year's unpaid months collectable, and reported by session", async () => {
    signInFor(school);
    const old = await prisma.feeCharge.findFirstOrThrow({
      where: { studentId: school.students[1].id, sessionId: lastYear.id },
      include: { items: true },
      orderBy: { dueDate: "asc" },
    });
    const due = r2(
      old.items.reduce((s, i) => s + num(i.amount) - num(i.paidAmount), 0),
    );
    const paid = await allocatePayment({
      studentId: school.students[1].id,
      monthPayments: [{ chargeId: old.id, amount: due }],
      method: "CASH",
    });
    expect(paid).toMatchObject({ success: true });

    const ledger = (sessionId: string) =>
      getLedgerData(school.id, { ...DEFAULT_LEDGER_QUERY, sessionId }, TZ);
    const last = await ledger(lastYear.id);
    expect(r2(last.metrics.totalInflow)).toBe(due);
    const current = await ledger(thisYear.id);
    // Only the advance settlement touched this year's bills; it isn't new money.
    expect(current.metrics.totalInflow).toBe(0);
  });

  it("doesn't bill a month twice when two sessions overlap", async () => {
    const overlap = await makeSchool("Overlap", 2);
    // Staff set the new year to start a month early, overlapping the old one.
    const older = await makeSession(overlap, "Old", -11, 0, false);
    const newer = await makeSession(overlap, "New", 0, 11, true);
    await makeStructure(overlap, older.id, 2000);
    await makeStructure(overlap, newer.id, 2000);
    for (const session of [older, newer]) {
      await generateMonthlyFees(
        session.id,
        [overlap.cls.id],
        "",
        `${monthAt(0).key}-10`,
        monthAt(0).key,
      );
    }
    const bills = await prisma.feeCharge.count({
      where: { schoolId: overlap.id, periodKey: monthAt(0).key },
    });
    expect(bills, "one bill per student for the month").toBe(2);
  });

  it("bills this month even when next year's session was made current early", async () => {
    const early = await makeSchool("Early", 2);
    const now = await makeSession(early, "This year", -6, 0, false);
    // Next year, set up ahead of time and already marked current.
    const next = await makeSession(early, "Next year", 1, 12, true);
    await makeStructure(early, now.id, 2000);
    await makeStructure(early, next.id, 2100);
    await prisma.school.update({
      where: { id: early.id },
      data: { autoFeeGeneration: true },
    });
    await runJob(`?schoolId=${early.id}`);
    const bills = await prisma.feeCharge.findMany({
      where: { schoolId: early.id },
    });
    expect(
      bills.map((b) => [b.periodKey, b.sessionId]),
      "this month's bills, in the session it belongs to",
    ).toEqual([
      [monthAt(0).key, now.id],
      [monthAt(0).key, now.id],
    ]);
  });
});

// ─── Full payment only ──────────────────────────────────────────────────────

describe("a school that only takes full payments", () => {
  let school: School;
  let months: {
    id: string;
    due: number;
    items: { id: string; componentId: string; due: number }[];
  }[];
  const policy: FeePolicy = {
    mode: "FULL_ONLY",
    minPercentage: 0,
    minAmount: 0,
  };

  beforeAll(async () => {
    school = await makeSchool("Strict", 1);
    const session = await makeSession(school, "This year", -2, 9, true);
    await makeStructure(school, session.id, 2000);
    await prisma.school.update({
      where: { id: school.id },
      data: { feePaymentMode: "FULL_ONLY" },
    });
    for (const offset of [-2, -1]) {
      await generateMonthlyFees(
        session.id,
        [school.cls.id],
        "",
        `${monthAt(offset).key}-10`,
        monthAt(offset).key,
      );
    }
    // The older month is late, with a ₹150 fine on it.
    const late = await prisma.feeComponent.create({
      data: {
        schoolId: school.id,
        name: "Late Fee",
        category: "LATE_FEE",
        amount: 150,
      },
    });
    const oldest = await prisma.feeCharge.findFirstOrThrow({
      where: { schoolId: school.id },
      orderBy: { dueDate: "asc" },
    });
    await prisma.feeChargeItem.create({
      data: { chargeId: oldest.id, componentId: late.id, amount: 150 },
    });
  });

  beforeEach(async () => {
    school.signIn();
    const charges = await prisma.feeCharge.findMany({
      where: {
        schoolId: school.id,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      include: { items: true },
      orderBy: { dueDate: "asc" },
    });
    months = charges.map((c) => {
      const items = c.items
        .filter((i) => i.status !== "WAIVED")
        .map((i) => ({
          id: i.id,
          componentId: i.componentId,
          due: r2(num(i.amount) - num(i.paidAmount)),
        }));
      return { id: c.id, due: r2(items.reduce((s, i) => s + i.due, 0)), items };
    });
  });

  const student = () => school.students[0].id;
  const payments = () =>
    prisma.paymentTransaction.count({ where: { schoolId: school.id } });

  it("refuses part of a month, by month, by item or by fee type, and the screen agrees", async () => {
    const [oldest] = months;
    const before = await payments();

    const byMonth = await allocatePayment({
      studentId: student(),
      monthPayments: [{ chargeId: oldest.id, amount: r2(oldest.due - 150) }],
      method: "CASH",
    });
    expect(byMonth).toMatchObject({
      error: expect.stringMatching(/full monthly due/),
    });

    const tuition = oldest.items.find(
      (i) => i.componentId === school.fees.tuition.id,
    )!;
    const byItem = await allocatePayment({
      studentId: student(),
      itemPayments: [{ chargeItemId: tuition.id, amount: tuition.due }],
      method: "CASH",
    });
    expect(byItem).toMatchObject({
      error: expect.stringMatching(/full monthly due/),
    });

    const byFeeType = await allocatePayment({
      studentId: student(),
      componentPayments: [
        { componentId: school.fees.tuition.id, amount: 2000 },
      ],
      method: "CASH",
    });
    expect(byFeeType).toMatchObject({
      error: expect.stringMatching(/full component balance/),
    });
    expect(await payments(), "nothing recorded").toBe(before);

    // The collection screen stops the same part payment before it's sent.
    const charges = await prisma.feeCharge.findMany({
      where: { id: oldest.id },
      include: { items: { include: { component: true } } },
    });
    const { monthList } = buildMonthList(
      charges.map((c) => ({
        ...c,
        dueDate: iso(c.dueDate),
        items: c.items.map((i) => ({
          ...i,
          amount: num(i.amount),
          paidAmount: num(i.paidAmount),
        })),
      })) as any,
    );
    expect(monthList[0].totalDue).toBe(oldest.due);
    expect(
      firstPolicyError(
        monthList,
        { [oldest.id]: true },
        { [oldest.id]: String(oldest.due - 150) },
        policy,
      ),
    ).toMatch(/fully/);
    expect(
      firstPolicyError(
        monthList,
        { [oldest.id]: true },
        { [oldest.id]: String(oldest.due) },
        policy,
      ),
    ).toBeNull();
  });

  it("takes a full month, late fine included", async () => {
    const [oldest] = months;
    const res = await allocatePayment({
      studentId: student(),
      monthPayments: [{ chargeId: oldest.id, amount: oldest.due }],
      method: "UPI",
    });
    expect(res).toMatchObject({ success: true });
    const charge = await prisma.feeCharge.findUniqueOrThrow({
      where: { id: oldest.id },
      include: { items: true },
    });
    expect(charge.status).toBe("PAID");
    expect(charge.items.every((i) => i.status === "PAID")).toBe(true);
    expect((res as any).receiptData.paymentStatus).toBe("PAID_IN_FULL");
  });

  it("takes more than is due, keeping the rest as advance", async () => {
    const [next] = months;
    const res = await allocatePayment({
      studentId: student(),
      monthPayments: [{ chargeId: next.id, amount: r2(next.due + 500) }],
      method: "CASH",
    });
    expect(res).toMatchObject({ success: true });
    const advance = await prisma.advanceLedger.aggregate({
      where: { studentId: student() },
      _sum: { amount: true },
    });
    expect(num(advance._sum.amount)).toBe(500);
    expect((res as any).receiptData.remainingOutstanding).toBe(0);
  });
});
