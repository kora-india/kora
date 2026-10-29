import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { getLedgerData, getLedgerExport } from "../reports/ledger";
import {
  DEFAULT_LEDGER_QUERY,
  ledgerQueryToSearch,
  parseLedgerQuery,
  resolveLedgerRange,
  type LedgerQuery,
} from "../reports/ledger-query";
import {
  monthlyCollections,
  monthlyExpenses,
  monthlyPendingDues,
  recentMonths,
} from "../reports/monthly-totals";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `reports-school-${run}`;
const TZ = "Asia/Kolkata";

let classA: string;
let classB: string;
let tuitionId: string;
let transportId: string;
let accountantId: string;

const ledger = (q: Partial<LedgerQuery>) =>
  getLedgerData(schoolId, { ...DEFAULT_LEDGER_QUERY, ...q }, TZ);

describe("money reports", () => {
  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Reports School",
        subdomain: `reports-${run}`,
        timezone: TZ,
      },
    });
    const session = await prisma.academicSession.create({
      data: {
        schoolId,
        name: "2026-27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
      },
    });
    const a = await prisma.class.create({
      data: { schoolId, name: `5 ${run}`, grade: 5 },
    });
    const b = await prisma.class.create({
      data: { schoolId, name: `6 ${run}`, grade: 6 },
    });
    classA = a.id;
    classB = b.id;
    const [secA, secB] = await Promise.all([
      prisma.section.create({ data: { schoolId, classId: classA, name: "A" } }),
      prisma.section.create({ data: { schoolId, classId: classB, name: "A" } }),
    ]);

    const student = (
      name: string,
      classId: string,
      sectionId: string,
      isActive = true,
    ) =>
      prisma.student.create({
        data: {
          schoolId,
          classId,
          sectionId,
          isActive,
          rollNumber: `${name}-${run}`,
          admissionNumber: `REP-${name}-${run}`,
          name,
          parentName: "Parent",
          parentPhone: "9999999999",
        },
      });
    const asha = await student("Asha", classA, secA.id);
    const bharat = await student("Bharat", classB, secB.id);
    const left = await student("Left", classA, secA.id, false);

    const [tuition, transport] = await Promise.all([
      prisma.feeComponent.create({
        data: { schoolId, name: `Tuition ${run}`, amount: 1000 },
      }),
      prisma.feeComponent.create({
        data: { schoolId, name: `Transport ${run}`, amount: 500 },
      }),
    ]);
    tuitionId = tuition.id;
    transportId = transport.id;

    const charge = (
      studentId: string,
      dueDate: string,
      items: {
        componentId: string;
        amount: number;
        paidAmount: number;
        status: any;
      }[],
    ) =>
      prisma.feeCharge.create({
        data: {
          schoolId,
          studentId,
          sessionId: session.id,
          title: dueDate,
          dueDate: new Date(dueDate),
          items: { create: items },
        },
        include: { items: true },
      });
    // Asha, October: tuition 800 of 1000 paid, transport waived.
    const ashaOct = await charge(asha.id, "2026-10-10", [
      {
        componentId: tuitionId,
        amount: 1000,
        paidAmount: 800,
        status: "PARTIAL",
      },
      {
        componentId: transportId,
        amount: 500,
        paidAmount: 0,
        status: "WAIVED",
      },
    ]);
    // Bharat, September: nothing paid.
    await charge(bharat.id, "2026-09-10", [
      {
        componentId: tuitionId,
        amount: 1000,
        paidAmount: 0,
        status: "PENDING",
      },
    ]);
    // A student who has left, October.
    await charge(left.id, "2026-10-10", [
      { componentId: tuitionId, amount: 700, paidAmount: 0, status: "PENDING" },
    ]);
    const ashaTuition = ashaOct.items.find((i) => i.componentId === tuitionId)!;

    const accountant = await prisma.user.create({
      data: {
        schoolId,
        email: `reports-accountant-${run}@example.test`,
        password: "not-used",
        name: "Priya",
        role: "ACCOUNTANT",
      },
    });
    accountantId = accountant.id;

    const pay = (data: {
      studentId: string;
      amount: number;
      date: string;
      method?: any;
      status?: string;
      remarks?: string;
      allocate?: number;
      collectedById?: string;
    }) =>
      prisma.paymentTransaction.create({
        data: {
          schoolId,
          studentId: data.studentId,
          amount: data.amount,
          date: new Date(data.date),
          method: data.method ?? "CASH",
          status: data.status ?? "SUCCESS",
          remarks: data.remarks,
          collectedById: data.collectedById,
          receiptNo: `R-${run}-${Math.random().toString(36).slice(2, 8)}`,
          ...(data.allocate
            ? {
                allocations: {
                  create: [
                    { chargeItemId: ashaTuition.id, amount: data.allocate },
                  ],
                },
              }
            : {}),
        },
      });
    // 2 Oct 01:30 in India, still 1 Oct in UTC.
    await pay({
      studentId: asha.id,
      amount: 600,
      date: "2026-10-01T20:00:00Z",
      allocate: 600,
      collectedById: accountantId,
    });
    // 1 Oct 01:30 in India, 30 Sep in UTC.
    await pay({
      studentId: bharat.id,
      amount: 250,
      date: "2026-09-30T20:00:00Z",
      method: "UPI",
      remarks: "paid_50% now",
    });
    // An advance settlement: applied to a charge, not new money.
    await pay({
      studentId: asha.id,
      amount: 200,
      date: "2026-10-05T05:00:00Z",
      status: "ADJUSTMENT",
      allocate: 200,
    });
    await pay({
      studentId: bharat.id,
      amount: 100,
      date: "2026-09-15T06:00:00Z",
    });

    const category = await prisma.expenseCategory.create({
      data: { schoolId, name: `Supplies ${run}` },
    });
    await prisma.expense.createMany({
      data: [
        {
          schoolId,
          categoryId: category.id,
          amount: 300,
          paymentMethod: "CASH",
          title: "Chalk",
          date: new Date("2026-10-03T06:00:00Z"),
        },
        {
          schoolId,
          categoryId: category.id,
          amount: 150,
          paymentMethod: "UPI",
          title: "Paper",
          date: new Date("2026-09-20T06:00:00Z"),
        },
      ],
    });
    await prisma.advanceLedger.create({
      data: {
        studentId: asha.id,
        amount: 50,
        createdAt: new Date("2026-10-04T06:00:00Z"),
      },
    });
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
    await prisma.user.deleteMany({ where: { id: accountantId } });
  });

  describe("ledger", () => {
    it("totals every matching row and lists money in and out by date", async () => {
      const data = await ledger({});

      // Advance credits and settlements move money already counted, so
      // they're only listed under Advances.
      expect(data.total).toBe(5);
      expect(data.rows.map((r) => [r.kind, r.amount])).toEqual([
        ["expense", 300],
        ["collection", 600],
        ["collection", 250],
        ["expense", 150],
        ["collection", 100],
      ]);
      const m = data.metrics;
      expect(m.totalInflow).toBe(950);
      expect(m.inflowCount).toBe(3);
      expect(m.totalOutflow).toBe(450);
      expect(m.outflowCount).toBe(2);
      expect(m.netPosition).toBe(500);
      // Waived items are not billed; students who left still are.
      expect(m.totalBilledFees).toBe(2700);
      expect(m.totalReceivables).toBe(1900);
      expect(m.collectionRate).toBe(29.6);
    });

    it("pages the list but not the totals", async () => {
      const second = await ledger({ page: 2 });
      expect(second.rows).toEqual([]);
      expect(second.total).toBe(5);
      expect(second.metrics.totalInflow).toBe(950);
    });

    it("says who took each payment", async () => {
      const { rows } = await ledger({ stream: "inflow" });
      const byAmount = Object.fromEntries(rows.map((r) => [r.amount, r]));
      expect(byAmount[600].doneBy).toEqual({
        name: "Priya",
        role: "ACCOUNTANT",
      });
      // Taken before collectors were recorded.
      expect(byAmount[250].doneBy).toBeNull();
      expect(byAmount[600].detail).toBe(`5 ${run}-A`);
    });

    it("lists advance credits and settlements under Advances", async () => {
      const { rows, total, metrics } = await ledger({ stream: "advance" });
      expect(total).toBe(2);
      expect(rows.map((r) => [r.kind, r.amount])).toEqual([
        ["settlement", 200],
        ["advance", 50],
      ]);
      // An automatic settlement is the system's doing.
      expect(rows[0].doneBy).toEqual({ name: "System", role: "SYSTEM" });
      // The type only picks what's listed; the totals stay the period's.
      expect(metrics.totalInflow).toBe(950);
    });

    it("uses calendar dates in the school's time zone", async () => {
      const { metrics, rows } = await ledger({
        period: "custom",
        from: "2026-10-02",
        to: "2026-10-31",
        stream: "inflow",
      });
      // The 1 Oct (India) payment is out; the 2 Oct one, still 1 Oct in UTC, is in.
      expect(metrics.totalInflow).toBe(600);
      expect(rows).toHaveLength(1);
      expect(metrics.totalOutflow).toBe(300);
      // Fee items count by the charge's due date.
      expect(metrics.totalBilledFees).toBe(1700);
    });

    it("applies the filters to totals and rows alike", async () => {
      const classOnly = await ledger({ classId: classB });
      expect(classOnly.metrics.totalInflow).toBe(350);
      // Expenses are school-wide, so a class filter leaves them out.
      expect(classOnly.metrics.totalOutflow).toBe(0);
      expect(classOnly.rows.some((r) => r.kind === "expense")).toBe(false);

      const upi = await ledger({ method: "UPI" });
      expect(upi.metrics.totalInflow).toBe(250);
      expect(upi.metrics.totalOutflow).toBe(150);

      const name = await ledger({ q: "asha" });
      expect(name.metrics.totalInflow).toBe(600);
      expect(name.total).toBe(1);
      const nameAdvances = await ledger({ q: "asha", stream: "advance" });
      expect(nameAdvances.total).toBe(2);

      const outflow = await ledger({ stream: "outflow" });
      expect(outflow.total).toBe(2);
      expect(outflow.rows.every((r) => r.kind === "expense")).toBe(true);

      const transport = await ledger({ item: `comp_${transportId}` });
      expect(transport.metrics.totalInflow).toBe(0);
      expect(transport.metrics.totalBilledFees).toBe(0);
      // Advances without a component apply to any component.
      const transportAdvances = await ledger({
        item: `comp_${transportId}`,
        stream: "advance",
      });
      expect(transportAdvances.rows.map((r) => r.kind)).toEqual(["advance"]);
    });

    it("treats % and _ in a search as plain characters", async () => {
      const underscore = await ledger({ q: "_" });
      expect(underscore.total).toBe(1);
      const percent = await ledger({ q: "50%" });
      expect(percent.metrics.totalInflow).toBe(250);
    });

    it("exports every matching row", async () => {
      const { rows, total } = await getLedgerExport(
        schoolId,
        { ...DEFAULT_LEDGER_QUERY, stream: "outflow" },
        TZ,
      );
      expect(total).toBe(2);
      expect(rows.map((r) => r.particulars)).toEqual(["Chalk", "Paper"]);
    });
  });

  describe("monthly totals", () => {
    const months = recentMonths(2, TZ, new Date("2026-10-21T06:00:00Z"));

    it("lists months oldest first", () => {
      expect(months).toEqual([
        { key: "2026-09", label: "Sept" },
        { key: "2026-10", label: "Oct" },
      ]);
    });

    it("sums collections by the school's month, leaving out settlements", async () => {
      const totals = await monthlyCollections(schoolId, months, TZ);
      expect(totals.get("2026-09")).toBe(100);
      expect(totals.get("2026-10")).toBe(850);
    });

    it("sums expenses by month", async () => {
      const totals = await monthlyExpenses(schoolId, months, TZ);
      expect(totals.get("2026-09")).toBe(150);
      expect(totals.get("2026-10")).toBe(300);
    });

    it("sums what active students still owe by due month", async () => {
      const totals = await monthlyPendingDues(schoolId, months);
      expect(totals.get("2026-09")).toBe(1000);
      expect(totals.get("2026-10")).toBe(200);
    });
  });
});

describe("ledger query", () => {
  it("falls back to defaults for unknown values", () => {
    expect(
      parseLedgerQuery({
        period: "forever",
        stream: "sideways",
        method: "cash; drop",
        item: "x",
        page: "-3",
      }),
    ).toEqual(DEFAULT_LEDGER_QUERY);
  });

  it("reads a custom range, putting the dates in order", () => {
    const q = parseLedgerQuery({
      period: "custom",
      from: "2026-10-31",
      to: "2026-10-01",
    });
    expect([q.from, q.to]).toEqual(["2026-10-01", "2026-10-31"]);
    expect(
      parseLedgerQuery({ period: "custom", from: "2026-02-30" }).from,
    ).toBeNull();
  });

  it("round-trips through the URL", () => {
    const q: LedgerQuery = {
      ...DEFAULT_LEDGER_QUERY,
      period: "custom",
      from: "2026-10-01",
      to: null,
      method: "UPI",
      classId: "c1",
      item: "comp_x",
      q: "asha",
      page: 3,
    };
    const search = ledgerQueryToSearch(q);
    expect(
      parseLedgerQuery(Object.fromEntries(new URLSearchParams(search))),
    ).toEqual(q);
    expect(ledgerQueryToSearch(DEFAULT_LEDGER_QUERY)).toBe("");
  });

  it("resolves periods to calendar dates", () => {
    const today = "2026-10-21"; // a Wednesday
    const range = (period: LedgerQuery["period"]) =>
      resolveLedgerRange({ period, from: null, to: null }, today);
    expect(range("this_week")).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
    });
    expect(range("yesterday")).toEqual({
      start: "2026-10-20",
      end: "2026-10-20",
    });
    expect(range("all")).toEqual({ start: null, end: null });
    expect(
      resolveLedgerRange(
        { period: "last_month", from: null, to: null },
        "2027-01-15",
      ),
    ).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(
      resolveLedgerRange(
        { period: "this_month", from: null, to: null },
        "2028-02-03",
      ),
    ).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});
