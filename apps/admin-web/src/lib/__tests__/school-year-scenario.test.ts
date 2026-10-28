/**
 * A school's year of money, end to end, through the same server actions the
 * screens call: students, fee structures with every billing frequency,
 * transport, monthly dues, expenses, teacher pay, late fees, and payments of
 * every kind in a random (seeded, so repeatable) order. After each stage the
 * books are checked against an independent model, and against each other:
 * fee items, payments, receipts, advances, the ledger and the dashboard.
 *
 * Runs against the test database (src/test/setup.ts); the school it creates
 * is purged afterwards. SCENARIO_SEED=<n> runs a different random order.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
// Next.js resolves "server-only" at build time; vitest can't.
vi.mock("server-only", () => ({}));
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { createStudent, deleteStudent } from "../actions/students";
import {
  assignFeeStructureToClass,
  createAcademicSession,
  createFeeComponent,
  createFeeStructure,
  saveFeeCollectionPolicy,
  saveLateFeeSettings,
  setStudentFeeOverride,
} from "../actions/fee-settings";
import { generateMonthlyFees } from "../actions/fee-generator";
import {
  allocatePayment,
  getFeeReceiptDetails,
  waiveFeeChargeItem,
} from "../actions/fee-allocator";
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
} from "../actions/expenses";
import {
  createRoute,
  createVehicle,
  enrollStudentTransport,
} from "../actions/transport";
import { createTeacher } from "../actions/teachers";
import { generateSalarySlip, processPayout } from "../actions/payroll";
import { GET as applyLateFees } from "@/app/api/cron/apply-late-fees/route";
import { getLedgerData } from "../reports/ledger";
import { DEFAULT_LEDGER_QUERY } from "../reports/ledger-query";
import {
  monthlyCollections,
  monthlyExpenses,
  monthlyPendingDues,
  recentMonths,
} from "../reports/monthly-totals";
import { deriveChargeStatus } from "../fees/charge-status";
import { todayInTimeZone } from "../fees/timezone";

// ─── Helpers ────────────────────────────────────────────────────────────────

// SCENARIO_SEED=<n> replays another random order of payments.
const SEED = Number(process.env.SCENARIO_SEED) || 20261028;
/** mulberry32: a small seeded generator, so a failing run can be replayed. */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seededRandom(SEED);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];

// + 0 turns -0 (from subtracting equal amounts) into 0.
const r2 = (n: number) => Math.round(n * 100) / 100 + 0;
const num = (d: unknown) => Number(d ?? 0);
const sum = <T>(xs: T[], f: (x: T) => number) =>
  r2(xs.reduce((s, x) => s + f(x), 0));
/** True when a money figure is exactly rupees and paise, with no float noise. */
const isMoney = (n: number) => n === r2(n);

const TZ = "Asia/Kolkata";
const today = todayInTimeZone(TZ);
const pad = (n: number) => String(n).padStart(2, "0");
/** The month `offset` months from today's, in the school's calendar. */
function monthAt(offset: number) {
  const d = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1),
  );
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return { key: `${year}-${pad(month)}`, year, month };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Session: six months ago to five months ahead. Months 0-5 are past (their
// fees are overdue), month 6 is this month (due in a few days), month 7 next.
const SESSION_START = monthAt(-6);
const SESSION_END = new Date(
  Date.UTC(SESSION_START.year, SESSION_START.month - 1 + 12, 0),
);
const MONTHS = Array.from({ length: 8 }, (_, m) => monthAt(m - 6));
const dueDateFor = (m: number) =>
  m < 6
    ? `${MONTHS[m].key}-10`
    : iso(new Date(today.getTime() + (m === 6 ? 5 : 35) * 86_400_000));

const schoolId = `scenario-${Math.random().toString(36).slice(2, 9)}`;
const CRON_SECRET = "scenario-cron-secret-1234567890";

// ─── What the scenario builds ───────────────────────────────────────────────

const FEES = {
  tuition: { name: "Tuition Fee", amount: 2400, frequency: "MONTHLY" },
  exam: { name: "Exam Fee", amount: 1200, frequency: "QUARTERLY" },
  annual: { name: "Annual Charges", amount: 3000, frequency: "YEARLY" },
  admission: { name: "Admission Fee", amount: 5000, frequency: "ONE_TIME" },
} as const;
type FeeKey = keyof typeof FEES;
/** Tuition per class: the structure overrides the component's 2,400. */
const TUITION = { A: 2450.5, B: 2800 } as const;

interface Pupil {
  key: string;
  cls: "A" | "B";
  id: string;
  /** Monthly bus fee from before fees were generated. */
  bus?: number;
  tuition?: { discount?: number; amount?: number };
  examExempt?: boolean;
}

const PUPILS: Omit<Pupil, "id">[] = [
  { key: "A1", cls: "A", tuition: { discount: 450.25 } },
  { key: "A2", cls: "A", tuition: { amount: 2100 } },
  { key: "A3", cls: "A", bus: 850 },
  { key: "A4", cls: "A" },
  { key: "A5", cls: "A" },
  { key: "A6", cls: "A" },
  { key: "B1", cls: "B", examExempt: true },
  { key: "B2", cls: "B", bus: 1200.75 },
  { key: "B3", cls: "B" },
  { key: "B4", cls: "B" },
];

/** What a pupil should be billed in month `m`, by component, before late fees. */
function expectedBill(p: Pupil, m: number): Record<string, number> {
  const bill: Record<string, number> = {};
  let tuition: number = p.tuition?.amount ?? TUITION[p.cls];
  if (p.tuition?.discount) tuition = r2(tuition - p.tuition.discount);
  bill[FEES.tuition.name] = tuition;
  if (m % 3 === 0 && !p.examExempt) bill[FEES.exam.name] = FEES.exam.amount;
  if (m === 0) {
    bill[FEES.annual.name] = FEES.annual.amount;
    bill[FEES.admission.name] = FEES.admission.amount;
  }
  if (p.bus) bill["Transport Fee"] = p.bus;
  return bill;
}

// ─── Shared state between the steps ─────────────────────────────────────────

const pupils = new Map<string, Pupil>();
const ids = {
  admin: "",
  session: "",
  classes: {} as Record<"A" | "B", { id: string; sectionId: string }>,
  components: {} as Record<FeeKey, string>,
  route: "",
  stops: [] as string[],
  vehicle: "",
  teachers: [] as { id: string; salary: number }[],
};
interface Collected {
  receiptNo: string;
  studentId: string;
  amount: number;
  method: string;
  kind: string;
}
const collected: Collected[] = [];
const rejected: { kind: string; error: string }[] = [];
let expensesTotal = 0;
let cashExpensesTotal = 0;
let payoutsTotal = 0;
let cashPayoutsTotal = 0;

const signInAsAdmin = () =>
  vi.mocked(auth).mockResolvedValue({
    user: {
      id: ids.admin,
      schoolId,
      role: "SCHOOL_ADMIN",
      name: "Scenario Admin",
      email: "admin@scenario.test",
    },
  } as any);

function ok<T extends { error?: unknown }>(result: T, what: string) {
  if (result && "error" in result && result.error) {
    throw new Error(`${what}: ${String(result.error)}`);
  }
  return result;
}

async function openCharges(studentId: string) {
  return prisma.feeCharge.findMany({
    where: { studentId, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    include: { items: { include: { component: true } } },
    orderBy: { dueDate: "asc" },
  });
}
type OpenCharge = Awaited<ReturnType<typeof openCharges>>[number];
const live = (c: OpenCharge) => c.items.filter((i) => i.status !== "WAIVED");
const chargeDue = (c: OpenCharge) =>
  sum(live(c), (i) => Math.max(0, num(i.amount) - num(i.paidAmount)));
const chargeBilled = (c: OpenCharge) => sum(live(c), (i) => num(i.amount));
/** The school's minimum for a part payment: 25% of what the month bills. */
const minPart = (c: OpenCharge) => r2(chargeBilled(c) * 0.25);

async function pay(
  kind: string,
  input: Omit<Parameters<typeof allocatePayment>[0], "method"> & {
    method?: Parameters<typeof allocatePayment>[0]["method"];
  },
) {
  const method =
    input.method ?? pick(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] as const);
  const res = await allocatePayment({ ...input, method });
  if ("error" in res && res.error) {
    rejected.push({ kind, error: String(res.error) });
    return null;
  }
  const amount = r2(
    sum(input.monthPayments ?? [], (m) => m.amount) +
      sum(input.itemPayments ?? [], (i) => i.amount) +
      sum(input.componentPayments ?? [], (c) => c.amount) +
      (input.generalAdvanceAmount ?? 0),
  );
  const receiptNo = (res as { receiptNo: string }).receiptNo;
  if (!collected.some((c) => c.receiptNo === receiptNo)) {
    collected.push({
      receiptNo,
      studentId: input.studentId,
      amount,
      method,
      kind,
    });
  }
  return res;
}

/** Every rule that must hold for the school's books at any point. */
async function checkBooks(stage: string) {
  const items = await prisma.feeChargeItem.findMany({
    where: { charge: { schoolId } },
    include: {
      allocations: { include: { payment: true } },
      charge: true,
    },
  });
  for (const it of items) {
    const where = `${stage}: item ${it.id} (${it.charge.title})`;
    const amount = num(it.amount);
    const paid = num(it.paidAmount);
    expect.soft(paid, `${where} paid ≥ 0`).toBeGreaterThanOrEqual(0);
    expect
      .soft(paid, `${where} paid ≤ billed`)
      .toBeLessThanOrEqual(amount + 0.001);
    expect
      .soft(
        sum(it.allocations, (a) => num(a.amount)),
        `${where} allocations = paid`,
      )
      .toBe(r2(paid));
    if (it.status !== "WAIVED") {
      const expected =
        paid >= amount && amount > 0
          ? ["PAID"]
          : paid > 0
            ? ["PARTIAL"]
            : ["PENDING", "OVERDUE"];
      expect
        .soft(expected, `${where} status ${it.status}`)
        .toContain(it.status);
    }
  }

  const charges = await prisma.feeCharge.findMany({
    where: { schoolId },
    include: { items: true },
  });
  for (const c of charges) {
    const derived = deriveChargeStatus(c.items, c.dueDate, today);
    // A charge falls due quietly: the nightly late-fee job marks it OVERDUE.
    const allowed =
      derived === "OVERDUE" ? ["OVERDUE", "PENDING", "PARTIAL"] : [derived];
    expect
      .soft(
        allowed,
        `${stage}: charge ${c.title} of ${c.studentId} is ${c.status}`,
      )
      .toContain(c.status);
  }

  // Each payment's money went somewhere: onto fee items, or into advance.
  const payments = await prisma.paymentTransaction.findMany({
    where: { schoolId },
    include: { allocations: true },
  });
  const advances = await prisma.advanceLedger.findMany({
    where: { student: { schoolId } },
  });
  for (const p of payments) {
    const allocated = sum(p.allocations, (a) => num(a.amount));
    if (p.status === "SUCCESS") {
      const deposited = sum(
        advances.filter(
          (a) =>
            num(a.amount) > 0 &&
            (a.description ?? "").includes(`payment ${p.receiptNo}`),
        ),
        (a) => num(a.amount),
      );
      expect
        .soft(
          r2(allocated + deposited),
          `${stage}: ${p.receiptNo} accounted for`,
        )
        .toBe(r2(num(p.amount)));
    } else {
      expect
        .soft(allocated, `${stage}: advance settlement ${p.receiptNo}`)
        .toBe(r2(num(p.amount)));
    }
  }

  // Nobody's advance balance goes below zero, overall or per component.
  const balances = new Map<string, number>();
  for (const a of advances) {
    const k = `${a.studentId}:${a.componentId ?? "general"}`;
    balances.set(k, r2((balances.get(k) ?? 0) + num(a.amount)));
  }
  for (const [k, v] of balances) {
    expect.soft(v, `${stage}: advance ${k}`).toBeGreaterThanOrEqual(0);
  }
}

// ─── The scenario ───────────────────────────────────────────────────────────

describe(`a school year of fees, expenses and pay (seed ${SEED})`, () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Scenario Public School",
        subdomain: schoolId,
        plan: "ENTERPRISE",
        timezone: TZ,
      },
    });
    ids.admin = (
      await prisma.user.create({
        data: {
          email: `admin-${schoolId}@scenario.test`,
          name: "Scenario Admin",
          password: "x",
          role: "SCHOOL_ADMIN",
          schoolId,
        },
      })
    ).id;
    signInAsAdmin();
  });

  afterAll(async () => {
    await prisma.payrollPayout.deleteMany({ where: { schoolId } });
    await prisma.salarySlip.deleteMany({ where: { schoolId } });
    await prisma.expense.deleteMany({ where: { schoolId } });
    await prisma.expenseCategory.deleteMany({ where: { schoolId } });
    await purgeSchool(prisma, schoolId);
  });

  it("sets up the session, classes, fee structures and students", async () => {
    ok(
      await createAcademicSession({
        name: "Scenario Session",
        startDate: `${SESSION_START.key}-01`,
        endDate: iso(SESSION_END),
        isCurrent: true,
      }),
      "session",
    );
    ids.session = (await prisma.academicSession.findFirstOrThrow({
      where: { schoolId },
    }))!.id;

    for (const cls of ["A", "B"] as const) {
      const c = await prisma.class.create({
        data: {
          schoolId,
          name: `Grade ${cls === "A" ? 5 : 6}`,
          grade: cls === "A" ? 5 : 6,
        },
      });
      const s = await prisma.section.create({
        data: { schoolId, classId: c.id, name: "A" },
      });
      ids.classes[cls] = { id: c.id, sectionId: s.id };
    }

    for (const [key, fee] of Object.entries(FEES) as [
      FeeKey,
      (typeof FEES)[FeeKey],
    ][]) {
      ok(
        await createFeeComponent({
          name: fee.name,
          amount: fee.amount,
          frequency: fee.frequency,
          isOptional: false,
        }),
        `component ${fee.name}`,
      );
      ids.components[key] = (await prisma.feeComponent.findFirstOrThrow({
        where: { schoolId, name: fee.name },
      }))!.id;
    }

    for (const cls of ["A", "B"] as const) {
      ok(
        await createFeeStructure({
          name: `Class ${cls} fees`,
          sessionId: ids.session,
          components: [
            { componentId: ids.components.tuition, amount: TUITION[cls] },
            { componentId: ids.components.exam },
            { componentId: ids.components.annual },
            { componentId: ids.components.admission },
          ],
        }),
        "structure",
      );
      const structure = await prisma.feeStructure.findFirstOrThrow({
        where: { schoolId, name: `Class ${cls} fees` },
      });
      ok(
        await assignFeeStructureToClass(ids.classes[cls].id, structure.id),
        "assign",
      );
    }

    let roll = 0;
    for (const p of PUPILS) {
      roll++;
      const res = ok(
        await createStudent({
          name: `Pupil ${p.key}`,
          rollNumber: String(roll),
          admissionNumber: `ADM-${p.key}`,
          classId: ids.classes[p.cls].id,
          sectionId: ids.classes[p.cls].sectionId,
          gender: roll % 2 ? "FEMALE" : "MALE",
          parentName: `Parent ${p.key}`,
          parentPhone: `98765432${pad(roll)}`,
        }),
        `student ${p.key}`,
      ) as { id?: string; student?: { id: string } };
      const id =
        res.id ??
        res.student?.id ??
        (await prisma.student.findFirstOrThrow({
          where: { schoolId, admissionNumber: `ADM-${p.key}` },
        }))!.id;
      pupils.set(p.key, { ...p, id });
    }
    expect(await prisma.student.count({ where: { schoolId } })).toBe(10);

    // Concessions: a discount, an agreed amount, an exemption.
    const a1 = pupils.get("A1")!;
    ok(
      await setStudentFeeOverride(a1.id, ids.session, ids.components.tuition, {
        isExempt: false,
        discountAmount: 450.25,
      }),
      "discount",
    );
    ok(
      await setStudentFeeOverride(
        pupils.get("A2")!.id,
        ids.session,
        ids.components.tuition,
        { isExempt: false, discountAmount: 0, amount: 2100 },
      ),
      "agreed amount",
    );
    ok(
      await setStudentFeeOverride(
        pupils.get("B1")!.id,
        ids.session,
        ids.components.exam,
        { isExempt: true, discountAmount: 0 },
      ),
      "exemption",
    );
  });

  it("adds a bus, a route and riders", async () => {
    const vehicle = ok(
      await createVehicle({
        registrationNo: "JH01AB1234",
        type: "BUS",
        capacity: 40,
        driverName: "Ramesh",
        driverPhone: "9876500000",
        status: "ACTIVE",
      }),
      "vehicle",
    ) as { vehicle: { id: string } };
    ids.vehicle = vehicle.vehicle.id;

    const route = ok(
      await createRoute({
        name: "North Route",
        vehicleId: ids.vehicle,
        startPoint: "Depot",
        endPoint: "School",
        defaultRatePerKm: 100,
        status: "ACTIVE",
        stops: [
          { stopName: "Market", sequenceOrder: 1, distanceFromSchoolKm: 4 },
          { stopName: "Lake", sequenceOrder: 2, distanceFromSchoolKm: 7 },
        ] as any,
      }),
      "route",
    ) as { route: { id: string; stops: { id: string }[] } };
    ids.route = route.route.id;
    ids.stops = route.route.stops.map((s) => s.id);

    for (const p of pupils.values()) {
      if (!p.bus) continue;
      ok(
        await enrollStudentTransport({
          studentId: p.id,
          routeId: ids.route,
          stopId: ids.stops[0],
          vehicleId: ids.vehicle,
          tripType: "TWO_WAY",
          distanceKm: 4,
          monthlyFee: p.bus,
          status: "ACTIVE",
        }),
        `bus for ${p.key}`,
      );
    }
    expect(
      await prisma.studentTransport.count({
        where: { schoolId, status: "ACTIVE" },
      }),
    ).toBe(2);
  });

  it("generates seven months of dues exactly as configured, once", async () => {
    for (let m = 0; m <= 6; m++) {
      const res = ok(
        await generateMonthlyFees(
          ids.session,
          [ids.classes.A.id, ids.classes.B.id],
          "",
          dueDateFor(m),
          MONTHS[m].key,
        ),
        `generate ${MONTHS[m].key}`,
      ) as { generatedCount: number };
      expect(res.generatedCount, MONTHS[m].key).toBe(10);
    }

    // Running a month again bills nobody twice.
    const again = ok(
      await generateMonthlyFees(
        ids.session,
        [ids.classes.A.id, ids.classes.B.id],
        "",
        dueDateFor(3),
        MONTHS[3].key,
      ),
      "generate again",
    ) as { generatedCount: number; alreadyGeneratedCount: number };
    expect(again.generatedCount).toBe(0);
    expect(again.alreadyGeneratedCount).toBe(10);

    const charges = await prisma.feeCharge.findMany({
      where: { schoolId },
      include: { items: { include: { component: true } } },
    });
    expect(charges).toHaveLength(70);
    for (const p of pupils.values()) {
      for (let m = 0; m <= 6; m++) {
        const charge = charges.find(
          (c) => c.studentId === p.id && c.periodKey === MONTHS[m].key,
        );
        const billed = Object.fromEntries(
          (charge?.items ?? []).map((i) => [i.component.name, num(i.amount)]),
        );
        expect
          .soft(billed, `${p.key} ${MONTHS[m].key}`)
          .toEqual(expectedBill(p, m));
      }
    }
    await checkBooks("after generation");
  });

  it("records expenses and teacher pay", async () => {
    const categories: Record<string, string> = {};
    for (const name of ["Utilities", "Maintenance", "Stationery"]) {
      const res = ok(await createExpenseCategory({ name }), name) as {
        id: string;
      };
      categories[name] = res.id;
    }
    const expenses = [
      { c: "Utilities", amount: 8450.55, m: 1, method: "BANK_TRANSFER" },
      { c: "Utilities", amount: 9120.4, m: 3, method: "UPI" },
      { c: "Maintenance", amount: 15000, m: 2, method: "CASH" },
      { c: "Maintenance", amount: 2340.1, m: 4, method: "CASH" },
      { c: "Stationery", amount: 999.99, m: 5, method: "CASH" },
      { c: "Stationery", amount: 1250, m: 5, method: "UPI" },
    ] as const;
    const created: string[] = [];
    for (const e of expenses) {
      const res = ok(
        await createExpense({
          categoryId: categories[e.c],
          amount: e.amount,
          date: `${MONTHS[e.m].key}-15`,
          title: `${e.c} ${MONTHS[e.m].key}`,
          paymentMethod: e.method,
        }),
        "expense",
      ) as { id: string };
      created.push(res.id);
      expensesTotal = r2(expensesTotal + e.amount);
      if (e.method === "CASH")
        cashExpensesTotal = r2(cashExpensesTotal + e.amount);
    }
    // One entered by mistake and removed.
    ok(await deleteExpense(created[3]), "delete expense");
    expensesTotal = r2(expensesTotal - 2340.1);
    cashExpensesTotal = r2(cashExpensesTotal - 2340.1);

    for (const [i, salary] of [32000, 28500.5, 41000].entries()) {
      const res = ok(
        await createTeacher({
          name: `Teacher ${i + 1}`,
          email: `teacher${i + 1}-${schoolId}@scenario.test`,
          subject: "Maths",
          salary,
        }),
        "teacher",
      ) as { id: string };
      ids.teachers.push({ id: res.id, salary });
    }

    const slipNumbers: string[] = [];
    for (const offset of [-2, -1]) {
      const { year, month } = monthAt(offset);
      for (const t of ids.teachers) {
        const res = ok(
          await generateSalarySlip({
            teacherId: t.id,
            year,
            month,
            basicSalary: t.salary,
            allowances: 1500,
            pfDeduction: 1800,
            otherDeductions: 200.25,
          }),
          "slip",
        ) as {
          slip: {
            id: string;
            slipNumber: string;
            netSalary: number;
            grossSalary: number;
          };
        };
        expect.soft(res.slip.grossSalary).toBe(r2(t.salary + 1500));
        expect
          .soft(res.slip.netSalary)
          .toBe(r2(t.salary + 1500 - 1800 - 200.25));
        slipNumbers.push(res.slip.slipNumber);
        // Pay all but the last teacher's latest slip.
        if (!(offset === -1 && t === ids.teachers[2])) {
          const method = pick(["BANK_TRANSFER", "UPI", "CASH"] as const);
          const payout = ok(
            await processPayout({ slipId: res.slip.id, method }),
            "payout",
          ) as { payout: { amount: number } };
          expect.soft(payout.payout.amount).toBe(res.slip.netSalary);
          payoutsTotal = r2(payoutsTotal + res.slip.netSalary);
          if (method === "CASH") {
            cashPayoutsTotal = r2(cashPayoutsTotal + res.slip.netSalary);
          }
          // A slip is paid once.
          const twice = await processPayout({
            slipId: res.slip.id,
            method: "CASH",
          });
          expect
            .soft(twice)
            .toEqual({ error: "This salary has already been paid" });
        }
      }
    }
    // Slip numbers run per month: SAL-YYYY-MM-001, -002, -003.
    for (const offset of [-2, -1]) {
      const { year, month } = monthAt(offset);
      const prefix = `SAL-${year}-${pad(month)}-`;
      expect
        .soft(slipNumbers.filter((s) => s.startsWith(prefix)).sort())
        .toEqual(
          [1, 2, 3].map((n) => `${prefix}${String(n).padStart(3, "0")}`),
        );
    }

    // Each payout is money out, recorded once as a salary expense that
    // can't be deleted from the Expenses page.
    const salaries = await prisma.expense.findMany({
      where: { schoolId, category: { name: "Salaries" } },
    });
    expect.soft(salaries).toHaveLength(5);
    expect.soft(sum(salaries, (e) => num(e.amount))).toBe(payoutsTotal);
    expect.soft(await deleteExpense(salaries[0].id)).toMatchObject({
      error: expect.stringMatching(/salary payout/),
    });
  });

  it("refuses a part payment under the school's minimum, and writes nothing", async () => {
    ok(
      await saveFeeCollectionPolicy({
        feePaymentMode: "ALLOW_PARTIAL",
        minPartialPaymentPercentage: 25,
      }),
      "policy",
    );
    const b3 = pupils.get("B3")!;
    const [oldest] = await openCharges(b3.id);
    const before = await prisma.paymentTransaction.count({
      where: { schoolId },
    });
    const res = await allocatePayment({
      studentId: b3.id,
      monthPayments: [{ chargeId: oldest.id, amount: r2(minPart(oldest) - 1) }],
      method: "CASH",
    });
    expect(res).toMatchObject({
      error: expect.stringMatching(/Minimum partial payment/),
    });
    expect(await prisma.paymentTransaction.count({ where: { schoolId } })).toBe(
      before,
    );
    // Nor a zero or negative amount.
    expect(
      await allocatePayment({
        studentId: b3.id,
        monthPayments: [{ chargeId: oldest.id, amount: -50 }],
        method: "CASH",
      }),
    ).toMatchObject({ error: "Payment amount must be greater than zero." });
  });

  it("collects payments of every kind, in a random order", async () => {
    const order = [...pupils.values()].sort(() => random() - 0.5);
    const strategies = [
      "full-oldest",
      "partial",
      "multi",
      "overpay",
      "items",
      "component",
      "advance",
      "partial+advance",
      "none",
    ] as const;

    for (const p of order) {
      for (let round = 0; round < 3; round++) {
        const open = await openCharges(p.id);
        if (open.length === 0) break;
        const kind = pick(strategies);
        const oldest = open[0];
        switch (kind) {
          case "full-oldest":
            await pay(kind, {
              studentId: p.id,
              monthPayments: [
                { chargeId: oldest.id, amount: chargeDue(oldest) },
              ],
            });
            break;
          case "partial":
          case "partial+advance": {
            const due = chargeDue(oldest);
            const min = minPart(oldest);
            if (due <= min + 1) {
              await pay(kind, {
                studentId: p.id,
                monthPayments: [{ chargeId: oldest.id, amount: due }],
              });
              break;
            }
            const amount = r2(min + (due - min) * (0.1 + random() * 0.8));
            await pay(kind, {
              studentId: p.id,
              monthPayments: [{ chargeId: oldest.id, amount }],
              ...(kind === "partial+advance"
                ? { generalAdvanceAmount: 500 }
                : {}),
            });
            break;
          }
          case "multi":
            await pay(kind, {
              studentId: p.id,
              monthPayments: open
                .slice(0, 2 + Math.floor(random() * 2))
                .map((c) => ({ chargeId: c.id, amount: chargeDue(c) })),
            });
            break;
          case "overpay":
            await pay(kind, {
              studentId: p.id,
              monthPayments: [
                { chargeId: oldest.id, amount: r2(chargeDue(oldest) + 750) },
              ],
            });
            break;
          case "items": {
            // The newest month's tuition alone (later months bill less, so
            // tuition clears the 25% minimum).
            const newest = open[open.length - 1];
            const tuition = live(newest).find(
              (i) =>
                i.componentId === ids.components.tuition &&
                num(i.amount) > num(i.paidAmount),
            );
            if (!tuition) break;
            const due = r2(num(tuition.amount) - num(tuition.paidAmount));
            const rest = chargeDue(newest);
            // A part payment must reach the minimum, and a balance at or
            // under the minimum must be cleared whole.
            if (
              due < rest &&
              (due < minPart(newest) || rest <= minPart(newest))
            )
              break;
            await pay(kind, {
              studentId: p.id,
              itemPayments: [{ chargeItemId: tuition.id, amount: due }],
            });
            break;
          }
          case "component":
            await pay(kind, {
              studentId: p.id,
              componentPayments: [
                {
                  componentId: ids.components.tuition,
                  amount: r2(1000 + random() * 4000),
                },
              ],
            });
            break;
          case "advance":
            await pay(kind, { studentId: p.id, generalAdvanceAmount: 1000 });
            break;
          case "none":
            break;
        }
      }
    }

    // Submitted twice with the same key (a double click): one payment.
    const b3 = pupils.get("B3")!;
    const [b3oldest] = await openCharges(b3.id);
    const key = `dup-${schoolId}`;
    const first = await pay("idempotent", {
      studentId: b3.id,
      monthPayments: [{ chargeId: b3oldest.id, amount: chargeDue(b3oldest) }],
      idempotencyKey: key,
    });
    const second = await allocatePayment({
      studentId: b3.id,
      monthPayments: [{ chargeId: b3oldest.id, amount: chargeDue(b3oldest) }],
      method: "CASH",
      idempotencyKey: key,
    });
    expect((second as any).receiptNo).toBe((first as any)?.receiptNo);
    expect(
      await prisma.paymentTransaction.count({
        where: { schoolId, idempotencyKey: key },
      }),
    ).toBe(1);

    // Three desks collecting at the same moment.
    const desks = ["A4", "B2", "A6"].map((k) => pupils.get(k)!);
    const desksOpen = await Promise.all(desks.map((p) => openCharges(p.id)));
    await Promise.all(
      desks.map((p, i) =>
        desksOpen[i][0]
          ? pay("concurrent", {
              studentId: p.id,
              monthPayments: [
                {
                  chargeId: desksOpen[i][0].id,
                  amount: chargeDue(desksOpen[i][0]),
                },
              ],
            })
          : null,
      ),
    );

    // Two desks taking the same month's fee from one family at once: the
    // second payment must not overpay the month; it becomes advance.
    const a6 = pupils.get("A6")!;
    const [a6oldest] = await openCharges(a6.id);
    if (a6oldest) {
      const due = chargeDue(a6oldest);
      await Promise.all([
        pay("race", {
          studentId: a6.id,
          monthPayments: [{ chargeId: a6oldest.id, amount: due }],
        }),
        pay("race", {
          studentId: a6.id,
          monthPayments: [{ chargeId: a6oldest.id, amount: due }],
        }),
      ]);
    }

    console.info(
      `[scenario] ${collected.length} payments by kind:`,
      Object.fromEntries(
        strategies.map((s) => [
          s,
          collected.filter((c) => c.kind === s).length,
        ]),
      ),
      "refused:",
      rejected,
    );
    expect(rejected, "no valid payment was refused").toEqual([]);
    await checkBooks("after collections");
  });

  it("issues sequential receipts whose figures match the books", async () => {
    const payments = await prisma.paymentTransaction.findMany({
      where: { schoolId, status: "SUCCESS" },
      orderBy: { createdAt: "asc" },
      include: {
        allocations: {
          include: {
            chargeItem: { include: { charge: { include: { items: true } } } },
          },
        },
      },
    });
    expect(payments.length).toBe(collected.length);

    const year = Number(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
      }).format(new Date()),
    );
    const numbers = payments.map((p) => p.receiptNo).sort();
    expect(numbers).toEqual(
      payments.map((_, i) => `RCP-${year}-${String(i + 1).padStart(5, "0")}`),
    );

    for (const p of payments) {
      const res = await getFeeReceiptDetails(p.receiptNo);
      expect(res.success, p.receiptNo).toBe(true);
      const r = res.data!;
      const where = `receipt ${p.receiptNo}`;
      expect.soft(r.amountPaid, `${where} amount`).toBe(num(p.amount));
      expect
        .soft(
          sum(r.monthAllocations, (m) => m.paidNow),
          `${where} lines add up to the amount`,
        )
        .toBe(num(p.amount));

      const monthLines = r.monthAllocations.filter(
        (m) => m.chargeId !== "advance-deposit",
      );
      for (const m of monthLines) {
        expect
          .soft(
            r2(m.feeDue - m.previouslyPaid - m.paidNow),
            `${where} ${m.month} balance`,
          )
          .toBe(r2(m.balanceDue));
      }
      const stillDue = sum(monthLines, (m) => m.balanceDue);
      expect
        .soft(
          r2(r.remainingOutstanding),
          `${where} "remaining" = what its months still owe`,
        )
        .toBe(stillDue);
      expect
        .soft(
          r.paymentStatus,
          `${where} paid-in-full only when nothing is left`,
        )
        .toBe(stillDue > 0 ? "PARTIAL_PAYMENT" : "PAID_IN_FULL");

      for (const [field, value] of Object.entries({
        amountPaid: r.amountPaid,
        total: r.total,
        outstandingBefore: r.outstandingBefore,
        remainingOutstanding: r.remainingOutstanding,
        monthTotalBilled: r.monthTotalBilled,
        monthTotalPaid: r.monthTotalPaid,
        ...Object.fromEntries(
          r.monthAllocations.flatMap((m, i) => [
            [`line${i}.feeDue`, m.feeDue],
            [`line${i}.previouslyPaid`, m.previouslyPaid],
            [`line${i}.balanceDue`, m.balanceDue],
          ]),
        ),
      })) {
        expect
          .soft(
            isMoney(value),
            `${where} ${field}=${value} is rupees and paise`,
          )
          .toBe(true);
      }
    }
  });

  it("enrolls a new rider after fees were generated, charging the current month", async () => {
    const a5 = pupils.get("A5")!;
    // A5's family clears this month first, then signs up for the bus.
    const thisMonth = await prisma.feeCharge.findFirstOrThrow({
      where: { studentId: a5.id, periodKey: MONTHS[6].key },
      include: { items: { include: { component: true } } },
    });
    const due = chargeDue(thisMonth as any);
    if (due > 0) {
      await pay("this-month", {
        studentId: a5.id,
        monthPayments: [{ chargeId: thisMonth.id, amount: due }],
      });
    }
    ok(
      await enrollStudentTransport({
        studentId: a5.id,
        routeId: ids.route,
        stopId: ids.stops[1],
        vehicleId: ids.vehicle,
        tripType: "TWO_WAY",
        distanceKm: 7,
        monthlyFee: 950,
        status: "ACTIVE",
      }),
      "late rider",
    );
    pupils.set("A5", { ...a5, bus: undefined });
    const busItems = await prisma.feeChargeItem.findMany({
      where: {
        charge: { studentId: a5.id },
        component: { name: "Transport Fee" },
      },
      include: { charge: true },
    });
    // The bus started this month: no earlier month should carry it.
    expect
      .soft(
        busItems.map((i) => i.charge.periodKey),
        "the bus fee lands on this month, not an older unpaid one",
      )
      .toEqual(busItems.length ? [MONTHS[6].key] : []);
    await checkBooks("after the late rider");
  });

  it("waives a fee and withdraws a student", async () => {
    const a6 = pupils.get("A6")!;
    const annual = await prisma.feeChargeItem.findFirst({
      where: {
        componentId: ids.components.annual,
        charge: { studentId: a6.id },
        status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
      },
    });
    if (annual) {
      ok(await waiveFeeChargeItem(annual.id, "Sibling concession"), "waive");
      const after = await prisma.feeChargeItem.findUniqueOrThrow({
        where: { id: annual.id },
      });
      expect(after.status).toBe("WAIVED");
    }
    ok(await deleteStudent(pupils.get("B4")!.id), "withdraw");
    await checkBooks("after waiver and withdrawal");
  });

  it("applies late fees once, to overdue unpaid months only, within the caps", async () => {
    ok(
      await saveLateFeeSettings({
        lateFeeEnabled: true,
        lateFeeAmount: 150,
        lateFeeFrequency: "MONTHLY",
        maxLateFeeCap: 400,
      }),
      "late fee settings",
    );
    const cron = () =>
      applyLateFees(
        new Request("http://localhost/api/cron/apply-late-fees", {
          headers: { authorization: `Bearer ${CRON_SECRET}` },
        }),
      );
    expect((await cron()).status).toBe(200);

    const lateComp = await prisma.feeComponent.findFirstOrThrow({
      where: { schoolId, category: "LATE_FEE" },
    });
    const snapshot = async () =>
      prisma.feeCharge.findMany({
        where: { schoolId },
        include: { items: true, student: true },
        orderBy: { id: "asc" },
      });
    const charges = await snapshot();
    for (const c of charges) {
      const lateItems = c.items.filter((i) => i.componentId === lateComp.id);
      const principal = sum(
        c.items.filter((i) => i.componentId !== lateComp.id),
        (i) => num(i.amount),
      );
      const where = `${c.title} of ${c.student.name} (${c.status})`;
      const overdueOpen =
        c.dueDate < today &&
        c.student.isActive &&
        !["PAID", "WAIVED"].includes(c.status);
      if (!overdueOpen) {
        expect.soft(lateItems, `${where}: no late fee`).toHaveLength(0);
        continue;
      }
      expect.soft(lateItems, `${where}: one late fee`).toHaveLength(1);
      const days = Math.floor(
        (today.getTime() - c.dueDate.getTime()) / 86_400_000,
      );
      const months = Math.min(Math.max(1, Math.ceil(days / 30)), 3);
      const expected = Math.min(
        150 * months,
        400,
        Math.max(150, Math.round(principal * 0.5)),
      );
      expect
        .soft(num(lateItems[0]?.amount), `${where}: late fee for ${days} days`)
        .toBe(expected);
    }

    // The cron runs daily: a second run the same day changes nothing.
    await cron();
    const again = await snapshot();
    expect(
      again.map((c) => c.items.map((i) => `${i.id}:${num(i.amount)}`).sort()),
    ).toEqual(
      charges.map((c) => c.items.map((i) => `${i.id}:${num(i.amount)}`).sort()),
    );
    await checkBooks("after late fees");
  });

  it("clears dues in a second random round, late fees included", async () => {
    for (const p of [...pupils.values()].sort(() => random() - 0.5)) {
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: p.id },
      });
      if (!student.isActive) continue;
      const open = await openCharges(p.id);
      if (open.length === 0 || random() < 0.2) continue;
      const take = open.slice(0, 1 + Math.floor(random() * open.length));
      await pay("round-2", {
        studentId: p.id,
        monthPayments: take.map((c) => ({
          chargeId: c.id,
          amount: chargeDue(c),
        })),
      });
    }
    expect(rejected).toEqual([]);
    await checkBooks("after second round");
  });

  it("uses advance balances on next month's dues", async () => {
    const advanceBefore = await prisma.advanceLedger.aggregate({
      where: { student: { schoolId } },
      _sum: { amount: true },
    });
    ok(
      await generateMonthlyFees(
        ids.session,
        [ids.classes.A.id, ids.classes.B.id],
        "",
        dueDateFor(7),
        MONTHS[7].key,
      ),
      "next month",
    );
    const settlements = await prisma.paymentTransaction.findMany({
      where: { schoolId, status: "ADJUSTMENT" },
    });
    const advanceAfter = await prisma.advanceLedger.aggregate({
      where: { student: { schoolId } },
      _sum: { amount: true },
    });
    expect
      .soft(
        r2(num(advanceBefore._sum.amount) - num(advanceAfter._sum.amount)),
        "advance used = settlements",
      )
      .toBe(sum(settlements, (s) => num(s.amount)));

    // The late rider's bus is on next month's bill.
    const a5next = await prisma.feeCharge.findFirstOrThrow({
      where: { studentId: pupils.get("A5")!.id, periodKey: MONTHS[7].key },
      include: { items: { include: { component: true } } },
    });
    expect
      .soft(
        num(
          a5next.items.find((i) => i.component.name === "Transport Fee")
            ?.amount,
        ),
        "late rider's bus fee next month",
      )
      .toBe(950);
    await checkBooks("after next month's dues");
  });

  it("keeps the ledger and dashboard in agreement with the books", async () => {
    const payments = await prisma.paymentTransaction.findMany({
      where: { schoolId },
    });
    const success = payments.filter((p) => p.status === "SUCCESS");
    const totalCollected = sum(success, (p) => num(p.amount));
    expect(totalCollected, "collections recorded = collections taken").toBe(
      sum(collected, (c) => c.amount),
    );

    const items = await prisma.feeChargeItem.findMany({
      where: { charge: { schoolId } },
      include: { charge: { include: { student: true } }, allocations: true },
    });
    const live = items.filter((i) => i.status !== "WAIVED");
    const billed = sum(live, (i) => num(i.amount));
    const outstanding = sum(live, (i) =>
      Math.max(0, num(i.amount) - num(i.paidAmount)),
    );
    const advances = await prisma.advanceLedger.aggregate({
      where: { student: { schoolId } },
      _sum: { amount: true },
    });
    const allocations = sum(
      items.flatMap((i) => i.allocations),
      (a) => num(a.amount),
    );

    const classes = await prisma.class.findMany({ where: { schoolId } });
    const ledger = await getLedgerData(
      schoolId,
      DEFAULT_LEDGER_QUERY,
      classes,
      TZ,
    );
    const m = ledger.metrics;

    expect.soft(r2(m.totalInflow), "ledger: money in").toBe(totalCollected);
    expect.soft(m.inflowCount, "ledger: receipts").toBe(success.length);
    expect.soft(r2(m.totalBilledFees), "ledger: billed").toBe(billed);
    expect.soft(r2(m.totalReceivables), "ledger: receivable").toBe(outstanding);
    expect
      .soft(r2(m.totalAdvanceBalance), "ledger: advance balance")
      .toBe(r2(num(advances._sum.amount)));
    expect
      .soft(
        sum(m.componentDistribution, (c) => c.amount),
        "ledger: split by fee head = allocations",
      )
      .toBe(allocations);
    expect
      .soft(
        sum(m.classBreakdown, (c) => c.collectedAmount),
        "ledger: split by class = money in",
      )
      .toBe(totalCollected);
    expect
      .soft(
        r2(Object.values(m.methodStats).reduce((s, x) => s + x.inflow, 0)),
        "ledger: split by method = money in",
      )
      .toBe(totalCollected);
    expect
      .soft(r2(m.methodStats.cash.outflow), "ledger: cash spent")
      .toBe(r2(cashExpensesTotal + cashPayoutsTotal));
    // Salaries paid are money out too.
    expect
      .soft(r2(m.totalOutflow), "ledger: money out = expenses + salaries paid")
      .toBe(r2(expensesTotal + payoutsTotal));
    expect
      .soft(r2(m.netPosition), "ledger: net = in - out")
      .toBe(r2(totalCollected - expensesTotal - payoutsTotal));

    // The dashboard's monthly figures, over the year shown.
    const months = recentMonths(12, TZ);
    const total = (map: Map<string, number>) =>
      r2([...map.values()].reduce((s, v) => s + v, 0));
    expect
      .soft(
        total(await monthlyCollections(schoolId, months, TZ)),
        "dashboard: collections",
      )
      .toBe(totalCollected);
    expect
      .soft(
        total(await monthlyExpenses(schoolId, months, TZ)),
        "dashboard: expenses + salaries",
      )
      .toBe(r2(expensesTotal + payoutsTotal));
    const activeOpen = sum(
      items.filter(
        (i) =>
          i.charge.student.isActive &&
          ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status) &&
          i.charge.dueDate >= new Date(`${months[0].key}-01T00:00:00Z`),
      ),
      (i) => num(i.amount) - num(i.paidAmount),
    );
    expect
      .soft(
        total(await monthlyPendingDues(schoolId, months)),
        "dashboard: pending dues of current students",
      )
      .toBe(activeOpen);

    const withdrawnOwed = sum(
      live.filter((i) => !i.charge.student.isActive),
      (i) => Math.max(0, num(i.amount) - num(i.paidAmount)),
    );
    console.info(
      `[scenario] collected ₹${totalCollected}, billed ₹${billed}, outstanding ₹${outstanding} ` +
        `(₹${withdrawnOwed} of it from the withdrawn student, which the ledger counts and the dashboard doesn't), ` +
        `expenses ₹${expensesTotal}, salaries paid ₹${payoutsTotal}`,
    );
  });
});
