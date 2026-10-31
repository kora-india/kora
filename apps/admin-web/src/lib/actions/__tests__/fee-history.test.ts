import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";

// Next.js resolves "server-only" at build time; vitest can't.
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  checkFeeHistory,
  finishFeeHistoryImport,
  getFeeHistorySetup,
  getFeeHistoryTemplate,
  importFeeHistoryBatch,
  startFeeHistoryImport,
} from "../fee-history";
import { importOpeningBalances, undoFeeImport } from "../fee-import";
import { allocatePayment, getFeeReceiptDetails } from "../fee-allocator";
import { processClassFeeGeneration } from "@/lib/services/fee-generation-service";
import { GET as applyLateFees } from "@/app/api/cron/apply-late-fees/route";
import { getLedgerData } from "@/lib/reports/ledger";
import { DEFAULT_LEDGER_QUERY } from "@/lib/reports/ledger-query";
import { monthlyCollections } from "@/lib/reports/monthly-totals";
import type { FeeHistoryRow } from "@/lib/fees/fee-history";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `history-${run}`;
const year = new Date().getFullYear();

let sessionId: string;
let classId: string;
let sectionId: string;
let annualId: string;
let tuitionId: string;
let transportId: string;
const ids: Record<string, string> = {};
const adm = (name: string) => `FH-${name}-${run}`;

const signIn = (role = "SCHOOL_ADMIN") =>
  vi.mocked(auth).mockResolvedValue({
    user: { id: `user-${run}`, schoolId, role, name: "Asha Admin" },
  } as any);

let nextRow = 2;
const row = (
  name: string,
  month: string,
  over: Partial<FeeHistoryRow> = {},
): FeeHistoryRow => ({
  sheetRow: nextRow++,
  admissionNumber: adm(name),
  month,
  heads: { Tuition: "1000" },
  lateFee: "",
  discount: "",
  paid: "",
  paidOn: "",
  mode: "",
  receiptNo: "",
  reference: "",
  ...over,
});

/** The whole upload, as the dialog does it. */
async function importRows(
  rows: FeeHistoryRow[],
  options: { calculateLateFees?: boolean; continueLateFees?: boolean } = {},
) {
  const check = await checkFeeHistory({
    rows,
    calculateLateFees: options.calculateLateFees,
  });
  if ("error" in check) throw new Error(check.error);
  expect(check.problems).toEqual([]);
  const started = await startFeeHistoryImport({
    ...options,
    fileName: "history.xlsx",
    periods: check.periods,
    heads: check.heads,
  });
  if ("error" in started) throw new Error(started.error);
  const batch = await importFeeHistoryBatch({ importId: started.id, rows });
  if ("error" in batch) throw new Error(batch.error);
  const finished = await finishFeeHistoryImport(started.id);
  if ("error" in finished) throw new Error(finished.error);
  return { id: started.id, ...finished };
}

const bill = (studentId: string, periodKey: string) =>
  prisma.feeCharge.findFirst({
    where: { studentId, periodKey },
    include: { items: { include: { component: true } } },
  });

async function billOrThrow(studentId: string, periodKey: string) {
  const found = await bill(studentId, periodKey);
  if (!found) throw new Error(`No bill for ${periodKey}`);
  return found;
}

async function generate(periodKey: string) {
  const [y, m] = periodKey.split("-").map(Number);
  return processClassFeeGeneration(schoolId, sessionId, classId, {
    periodKey,
    title: `${periodKey} Fees`,
    dueDate: new Date(Date.UTC(y, m - 1, 10)),
  });
}

const runLateFees = () =>
  applyLateFees(
    new Request("https://app.test/api/cron/apply-late-fees", {
      headers: { authorization: "Bearer test-secret" },
    }),
  );

describe("fee history import", () => {
  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "History School",
        subdomain: `history-${run}`,
        timezone: "Asia/Kolkata",
        lateFeeEnabled: true,
        lateFeeAmount: 100,
        lateFeeFrequency: "MONTHLY",
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
    sessionId = session.id;
    const cls = await prisma.class.create({
      data: { schoolId, name: "Grade 5", grade: 5 },
    });
    classId = cls.id;
    const section = await prisma.section.create({
      data: { schoolId, classId, name: "A" },
    });
    sectionId = section.id;

    const comp = (name: string, amount: number, frequency: any, extra = {}) =>
      prisma.feeComponent.create({
        data: { schoolId, name, amount, frequency, ...extra },
      });
    const tuition = await comp("Tuition", 1000, "MONTHLY");
    const annual = await comp("Annual", 3000, "YEARLY");
    const transport = await comp("Transport Fee", 0, "MONTHLY", {
      category: "TRANSPORT",
    });
    tuitionId = tuition.id;
    annualId = annual.id;
    transportId = transport.id;
    await prisma.feeStructure.create({
      data: {
        schoolId,
        sessionId,
        name: "Standard",
        status: "ACTIVE",
        items: {
          create: [tuition, annual].map((c) => ({ componentId: c.id })),
        },
        classAssignments: { create: { classId } },
      },
    });

    for (const [i, name] of ["Asha", "Kabir"].entries()) {
      const student = await prisma.student.create({
        data: {
          schoolId,
          classId,
          sectionId,
          rollNumber: String(i + 1),
          admissionNumber: adm(name),
          name,
          parentName: "Parent",
          parentPhone: "9999999999",
        },
      });
      ids[name] = student.id;
    }
    process.env.CRON_SECRET = "test-secret";
  });

  beforeEach(async () => {
    signIn();
    await prisma.paymentAllocation.deleteMany({
      where: { payment: { schoolId } },
    });
    await prisma.paymentTransaction.deleteMany({ where: { schoolId } });
    await prisma.advanceLedger.deleteMany({ where: { student: { schoolId } } });
    await prisma.feeCharge.deleteMany({ where: { schoolId } });
    await prisma.feeImport.deleteMany({ where: { schoolId } });
    await prisma.activityLog.deleteMany({ where: { schoolId } });
    await prisma.studentFeeOverride.deleteMany({
      where: { student: { schoolId } },
    });
    await prisma.studentTransport.deleteMany({ where: { schoolId } });
    await prisma.academicSession.deleteMany({
      where: { schoolId, id: { not: sessionId } },
    });
    await prisma.feeComponent.deleteMany({
      where: {
        schoolId,
        id: { notIn: [tuitionId, annualId, transportId] },
      },
    });
    await prisma.school.update({
      where: { id: schoolId },
      data: { nextReceiptNumber: 1 },
    });
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  describe("access", () => {
    it.each(["ACCOUNTANT", "TEACHER"])("is closed to a %s", async (role) => {
      signIn(role);
      const rows = [row("Asha", "Apr 2026")];
      for (const result of [
        await getFeeHistorySetup(),
        await getFeeHistoryTemplate({ from: "2026-04", to: "2026-05" }),
        await checkFeeHistory({ rows }),
        await startFeeHistoryImport({ periods: [], heads: [] }),
        await importFeeHistoryBatch({ importId: "x", rows }),
        await finishFeeHistoryImport("x"),
      ]) {
        expect(result).toHaveProperty("error");
      }
      expect(await prisma.feeImport.count({ where: { schoolId } })).toBe(0);
    });
  });

  describe("setup", () => {
    it("starts at the session's first month and describes the late fee rule", async () => {
      const setup = await getFeeHistorySetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.firstMonth).toBe("2026-04");
      expect(setup.lateFeeRule).toBe("₹100 monthly");
      expect(setup.studentCount).toBe(2);
    });
  });

  describe("template", () => {
    const template = async (from = "2026-04", to = "2026-05") => {
      const res = await getFeeHistoryTemplate({ from, to });
      if ("error" in res) throw new Error(res.error);
      const index = (name: string) => res.headers.indexOf(name);
      return {
        ...res,
        cell: (student: string, month: string, header: string) =>
          res.rows.find(
            (r) => r[0] === adm(student) && r[index("Month")] === month,
          )?.[index(header)],
      };
    };

    it("has a row per student per month, with the fee heads as columns", async () => {
      const { headers, rows } = await template();
      expect(headers).toEqual([
        "Admission Number",
        "Student Name",
        "Class",
        "Section",
        "Month",
        "Annual (₹)",
        "Transport Fee (₹)",
        "Tuition (₹)",
        "Late Fee (₹)",
        "Discount (₹)",
        "Paid (₹)",
        "Paid On",
        "Mode",
        "Receipt No",
        "Reference",
      ]);
      expect(rows).toHaveLength(4);
      for (const r of rows) expect(r).toHaveLength(headers.length);
    });

    it("fills in monthly fees every month and yearly fees once", async () => {
      const { cell } = await template();
      expect(cell("Asha", "Apr 2026", "Tuition (₹)")).toBe("1000");
      expect(cell("Asha", "May 2026", "Tuition (₹)")).toBe("1000");
      expect(cell("Asha", "Apr 2026", "Annual (₹)")).toBe("3000");
      expect(cell("Asha", "May 2026", "Annual (₹)")).toBe("");
    });

    it("uses each student's concessions", async () => {
      await prisma.studentFeeOverride.create({
        data: {
          studentId: ids.Asha,
          sessionId,
          componentId: tuitionId,
          discountAmount: 200,
        },
      });
      await prisma.studentFeeOverride.create({
        data: {
          studentId: ids.Kabir,
          sessionId,
          componentId: annualId,
          isExempt: true,
        },
      });
      const { cell } = await template();
      expect(cell("Asha", "Apr 2026", "Tuition (₹)")).toBe("800");
      expect(cell("Kabir", "Apr 2026", "Annual (₹)")).toBe("");
    });

    it("adds transport from the month the student started", async () => {
      const route = await prisma.transportRoute.create({
        data: {
          schoolId,
          name: `Route ${run}`,
          startPoint: "A",
          endPoint: "B",
          stops: { create: { stopName: "Stop", sequenceOrder: 1 } },
        },
        include: { stops: true },
      });
      await prisma.studentTransport.create({
        data: {
          schoolId,
          studentId: ids.Asha,
          sessionId,
          routeId: route.id,
          stopId: route.stops[0].id,
          distanceKm: 2,
          monthlyFee: 800,
          startDate: new Date("2026-05-01"),
        },
      });
      const { cell } = await template();
      expect(cell("Asha", "Apr 2026", "Transport Fee (₹)")).toBe("");
      expect(cell("Asha", "May 2026", "Transport Fee (₹)")).toBe("800");
      await prisma.studentTransport.deleteMany({ where: { schoolId } });
      await prisma.transportRoute.delete({ where: { id: route.id } });
    });

    it("leaves out months already billed", async () => {
      await generate("2026-04");
      const { rows } = await template();
      expect(rows.map((r) => r[4])).toEqual(["May 2026", "May 2026"]);
    });

    it("doesn't repeat a yearly fee billed already", async () => {
      await generate("2026-04");
      const { cell } = await template();
      expect(cell("Asha", "May 2026", "Annual (₹)")).toBe("");
    });

    it("leaves out months inside an opening balance", async () => {
      await importOpeningBalances({
        asOfDate: "2026-04-30",
        rows: [
          {
            sheetRow: 2,
            admissionNumber: adm("Asha"),
            dues: "500",
            advance: "",
          },
        ],
      });
      const { rows } = await template();
      expect(rows.filter((r) => r[0] === adm("Asha")).map((r) => r[4])).toEqual(
        ["May 2026"],
      );
    });

    it("refuses months that can't be listed", async () => {
      const ask = (from: string, to: string) =>
        getFeeHistoryTemplate({ from, to });
      expect(await ask("2999-01", "2999-02")).toEqual({
        error: "The last month can't be in the future",
      });
      expect(await ask("2026-05", "2026-04")).toEqual({
        error: "Choose the months to include",
      });
      expect(await ask("2019-01", "2026-04")).toEqual({
        error: "Choose 5 years or fewer at a time",
      });
    });
  });

  describe("check", () => {
    it("reports what importing would do, and saves nothing", async () => {
      const res = await checkFeeHistory({
        rows: [
          row("Asha", "Apr 2025", {
            heads: { Tuition: "1000", "Old Library": "50" },
            lateFee: "100",
            paid: "800",
            paidOn: "05/04/2025",
          }),
        ],
      });
      expect(res).toMatchObject({
        success: true,
        problems: [],
        newHeads: ["Old Library"],
        newSessions: ["2025-26"],
      });
      expect("totals" in res && res.totals).toMatchObject({
        bills: 1,
        billed: 1150,
        paid: 800,
        dues: 350,
        lateFees: 100,
      });
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(0);
      expect(await prisma.academicSession.count({ where: { schoolId } })).toBe(
        1,
      );
    });
  });

  describe("import", () => {
    it("makes real bills with the right status, due on the 10th", async () => {
      await importRows([
        row("Asha", "Apr 2026", { paid: "1000", paidOn: "05/04/2026" }),
        row("Asha", "May 2026", { paid: "400", paidOn: "05/05/2026" }),
        row("Asha", "Jun 2026"),
      ]);

      const april = await billOrThrow(ids.Asha, "2026-04");
      expect(april).toMatchObject({ title: "April 2026", status: "PAID" });
      expect(april.dueDate.toISOString().slice(0, 10)).toBe("2026-04-10");
      expect(april.items[0].status).toBe("PAID");

      const may = await billOrThrow(ids.Asha, "2026-05");
      expect(may.status).toBe("OVERDUE");
      expect(may.items[0].status).toBe("PARTIAL");
      expect(Number(may.items[0].paidAmount)).toBe(400);

      const june = await billOrThrow(ids.Asha, "2026-06");
      expect(june.status).toBe("OVERDUE");
      expect(june.items[0].status).toBe("OVERDUE");
    });

    it("keeps old receipts, and makes one where there was none", async () => {
      const { id } = await importRows([
        row("Asha", "Apr 2026", {
          paid: "1000",
          paidOn: "05/04/2026",
          mode: "UPI",
          receiptNo: "OLD-1042",
          reference: "UTR99",
        }),
        row("Asha", "May 2026", { paid: "1000", paidOn: "05/05/2026" }),
      ]);

      const old = await prisma.paymentTransaction.findFirstOrThrow({
        where: { schoolId, receiptNo: "OLD-1042" },
        include: { allocations: true },
      });
      expect(old).toMatchObject({
        method: "UPI",
        reference: "UTR99",
        status: "SUCCESS",
        importId: id,
        collectedById: null,
      });
      expect(old.date.toISOString().slice(0, 10)).toBe("2026-04-05");
      expect(old.allocations).toHaveLength(1);

      const made = await prisma.paymentTransaction.findFirstOrThrow({
        where: { schoolId, receiptNo: { startsWith: "IMP-" } },
      });
      expect(made.method).toBe("OTHER");
    });

    it("keeps old payments out of Recent Payments", async () => {
      await importRows([
        row("Asha", "Apr 2026", { paid: "1000", paidOn: "05/04/2026" }),
      ]);
      const payment = await prisma.paymentTransaction.findFirstOrThrow({
        where: { schoolId },
      });
      expect(payment.createdAt.toISOString().slice(0, 10)).toBe("2026-04-05");
    });

    it("puts each month's late fee on the school's Late Fee head", async () => {
      await importRows([
        row("Asha", "Apr 2026", {
          lateFee: "150",
          paid: "1150",
          paidOn: "20/04/2026",
        }),
        row("Asha", "May 2026", {
          lateFee: "75",
          paid: "1000",
          paidOn: "20/05/2026",
        }),
      ]);

      const late = (await billOrThrow(ids.Asha, "2026-04")).items.find(
        (i) => i.component.category === "LATE_FEE",
      );
      expect(Number(late?.amount)).toBe(150);
      expect(late?.status).toBe("PAID");

      const may = await billOrThrow(ids.Asha, "2026-05");
      expect(may.status).toBe("OVERDUE");
      const mayLate = may.items.find(
        (i) => i.component.category === "LATE_FEE",
      );
      expect(Number(mayLate?.amount)).toBe(75);
      expect(Number(mayLate?.paidAmount)).toBe(0);
      expect(
        await prisma.feeComponent.count({
          where: { schoolId, category: "LATE_FEE" },
        }),
      ).toBe(1);
    });

    it("works blank late fees out from the rule when asked", async () => {
      const res = await importRows(
        [row("Asha", "Apr 2026", { paid: "1000", paidOn: "20/04/2026" })],
        { calculateLateFees: true },
      );
      expect(res.lateFees).toBe(100);
      expect(res.dues).toBe(100);
    });

    it("nets a discount and holds an overpayment as advance", async () => {
      const res = await importRows([
        row("Asha", "Apr 2026", {
          discount: "200",
          paid: "1000",
          paidOn: "05/04/2026",
          receiptNo: "R-5",
        }),
      ]);
      const april = await billOrThrow(ids.Asha, "2026-04");
      expect(Number(april.items[0].amount)).toBe(800);
      expect(april.status).toBe("PAID");

      const credit = await prisma.advanceLedger.findFirstOrThrow({
        where: { studentId: ids.Asha },
      });
      expect(Number(credit.amount)).toBe(200);
      expect(credit.description).toBe("Advance from receipt R-5");
      expect(res.advance).toBe(200);
    });

    it("adds what the file needs, switched off so it's never billed", async () => {
      await importRows([
        row("Asha", "Jun 2025", {
          heads: { "Old Library": "50" },
          paid: "50",
          paidOn: "05/06/2025",
        }),
      ]);
      const head = await prisma.feeComponent.findFirstOrThrow({
        where: { schoolId, name: "Old Library" },
      });
      expect(head.isActive).toBe(false);
      const past = await prisma.academicSession.findFirstOrThrow({
        where: { schoolId, name: "2025-26" },
      });
      expect(past.isCurrent).toBe(false);
      expect(past.startDate.toISOString().slice(0, 10)).toBe("2025-04-01");
      expect(past.endDate.toISOString().slice(0, 10)).toBe("2026-03-31");
      expect((await billOrThrow(ids.Asha, "2025-06")).sessionId).toBe(past.id);
    });

    it("records its totals and logs once", async () => {
      await importRows([
        row("Asha", "Apr 2026", { paid: "400", paidOn: "05/04/2026" }),
        row("Kabir", "Apr 2026", { lateFee: "50" }),
      ]);
      const setup = await getFeeHistorySetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.imports).toEqual([
        expect.objectContaining({
          finished: true,
          studentCount: 2,
          billCount: 2,
          totalBilled: 2050,
          totalPaid: 400,
          totalLateFees: 50,
          totalDues: 1650,
        }),
      ]);
      const logs = await prisma.activityLog.findMany({ where: { schoolId } });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("fee.history_import");
      expect(logs[0].summary).toContain("for 2 students: 2 bills");
    });

    it("adds nothing when the same file is uploaded again", async () => {
      const rows = [
        row("Asha", "Apr 2026", {
          paid: "1000",
          paidOn: "05/04/2026",
          receiptNo: "R-1",
        }),
      ];
      await importRows(rows);
      const again = await checkFeeHistory({ rows });
      expect(again).toMatchObject({ problems: [] });
      expect("totals" in again && again.totals).toMatchObject({
        bills: 0,
        payments: 0,
        alreadyBilled: 1,
      });
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(1);
    });

    it("saves across batches under one import", async () => {
      const first = [row("Asha", "Apr 2026")];
      const second = [row("Kabir", "Apr 2026")];
      const started = await startFeeHistoryImport({
        periods: ["2026-04"],
        heads: ["Tuition"],
      });
      if ("error" in started) throw new Error(started.error);
      await importFeeHistoryBatch({ importId: started.id, rows: first });
      await importFeeHistoryBatch({ importId: started.id, rows: second });
      const done = await finishFeeHistoryImport(started.id);
      expect(done).toMatchObject({ students: 2, bills: 2, billed: 2000 });
    });

    it("refuses a batch with a problem, saving none of it", async () => {
      const started = await startFeeHistoryImport({
        periods: ["2026-04"],
        heads: ["Tuition"],
      });
      if ("error" in started) throw new Error(started.error);
      const res = await importFeeHistoryBatch({
        importId: started.id,
        rows: [row("Asha", "Apr 2026"), row("Nobody", "Apr 2026")],
      });
      expect(res).toHaveProperty("error");
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(0);
    });

    it("won't add to a finished import", async () => {
      const { id } = await importRows([row("Asha", "Apr 2026")]);
      expect(
        await importFeeHistoryBatch({
          importId: id,
          rows: [row("Asha", "May 2026")],
        }),
      ).toEqual({ error: "This import isn't open" });
    });
  });

  describe("receipts", () => {
    it("moves the counter past old receipts in the school's own format", async () => {
      const receipt = (n: number) =>
        `RCP-${year}-${String(n).padStart(5, "0")}`;
      // More than new receipts will skip: this used to stop every new payment.
      const months = Array.from({ length: 60 }, (_, i) =>
        row(
          "Asha",
          `${String((i % 12) + 1).padStart(2, "0")}/${2021 + Math.floor(i / 12)}`,
          {
            paid: "1000",
            paidOn: "05/04/2025",
            receiptNo: receipt(i + 1),
          },
        ),
      );
      await importRows(months);
      const school = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
      });
      expect(school.nextReceiptNumber).toBe(61);

      const open = await importRows([row("Kabir", "Apr 2026")]);
      expect(open.bills).toBe(1);
      const dues = await billOrThrow(ids.Kabir, "2026-04");
      const paid = await allocatePayment({
        studentId: ids.Kabir,
        monthPayments: [{ chargeId: dues.id, amount: 1000 }],
        method: "CASH",
      });
      expect(paid).toMatchObject({ success: true, receiptNo: receipt(61) });
    });

    it("leaves the counter alone for receipts in another format", async () => {
      await importRows([
        row("Asha", "Apr 2026", {
          paid: "1000",
          paidOn: "05/04/2026",
          receiptNo: "OLD-99999",
        }),
      ]);
      const school = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
      });
      expect(school.nextReceiptNumber).toBe(1);
    });

    it("can be reopened, marked as imported", async () => {
      await importRows([
        row("Asha", "Apr 2026", {
          paid: "1000",
          paidOn: "05/04/2026",
          receiptNo: "OLD-7",
        }),
      ]);
      const receipt = await getFeeReceiptDetails("OLD-7");
      expect(receipt.success).toBe(true);
      expect(receipt.data).toMatchObject({
        receiptNo: "OLD-7",
        amountPaid: 1000,
        generatedBy: "Imported from earlier records",
      });
    });
  });

  describe("reports", () => {
    beforeEach(async () => {
      await importRows([
        row("Asha", "Apr 2026", { paid: "1000", paidOn: "05/04/2026" }),
        row("Kabir", "Apr 2026"),
      ]);
    });

    it("counts money on its real date, and what's still due", async () => {
      const { metrics, rows } = await getLedgerData(
        schoolId,
        DEFAULT_LEDGER_QUERY,
        "Asia/Kolkata",
      );
      expect(metrics.totalInflow).toBe(1000);
      expect(metrics.totalReceivables).toBe(1000);
      expect(rows[0].doneBy).toEqual({ name: "Imported", role: "IMPORTED" });

      const totals = await monthlyCollections(
        schoolId,
        [{ key: "2026-04", label: "Apr" }],
        "Asia/Kolkata",
      );
      expect(totals.get("2026-04")).toBe(1000);
    });
  });

  describe("afterwards", () => {
    it("doesn't bill those months or their yearly fees again", async () => {
      await importRows([
        row("Asha", "Apr 2026", {
          heads: { Tuition: "1000", Annual: "3000" },
        }),
      ]);
      await generate("2026-04");
      await generate("2026-05");

      const april = await billOrThrow(ids.Asha, "2026-04");
      expect(april.importId).not.toBeNull();
      const may = await billOrThrow(ids.Asha, "2026-05");
      expect(may.items.map((i) => i.component.name)).toEqual(["Tuition"]);
    });

    it("collects an unpaid month like any other bill", async () => {
      await importRows([row("Asha", "Apr 2026", { lateFee: "100" })]);
      const dues = await billOrThrow(ids.Asha, "2026-04");

      const paid = await allocatePayment({
        studentId: ids.Asha,
        monthPayments: [{ chargeId: dues.id, amount: 1100 }],
        method: "CASH",
      });

      expect(paid).toMatchObject({ success: true });
      expect((await billOrThrow(ids.Asha, "2026-04")).status).toBe("PAID");
    });
  });

  describe("late fees after importing", () => {
    const lateFeeOn = async (period: string) => {
      const found = await billOrThrow(ids.Asha, period);
      return found.items.find((i) => i.component.category === "LATE_FEE");
    };

    it("stay as the file has them unless the school asks", async () => {
      await importRows([
        row("Asha", "Apr 2026"),
        row("Asha", "May 2026", { lateFee: "40" }),
      ]);

      expect((await runLateFees()).status).toBe(200);

      expect(await lateFeeOn("2026-04")).toBeUndefined();
      expect(Number((await lateFeeOn("2026-05"))?.amount)).toBe(40);
    });

    it("keep running on unpaid months when the school asks", async () => {
      await importRows(
        [row("Asha", "Apr 2026"), row("Asha", "May 2026", { lateFee: "40" })],
        { continueLateFees: true },
      );

      await runLateFees();

      expect(Number((await lateFeeOn("2026-04"))?.amount)).toBeGreaterThan(0);
      expect(Number((await lateFeeOn("2026-05"))?.amount)).toBeGreaterThan(40);
    });

    it("never touch a month that's been paid", async () => {
      await importRows(
        [row("Asha", "Apr 2026", { paid: "1000", paidOn: "05/04/2026" })],
        { continueLateFees: true },
      );

      await runLateFees();

      expect(await lateFeeOn("2026-04")).toBeUndefined();
    });

    it("stop when the import is undone", async () => {
      const { id } = await importRows([row("Asha", "Apr 2026")], {
        continueLateFees: true,
      });
      await undoFeeImport(id);

      expect((await runLateFees()).status).toBe(200);

      expect(await bill(ids.Asha, "2026-04")).toBeNull();
    });
  });

  describe("opening balances", () => {
    it("leaves out months a balance already covers, so dues don't count twice", async () => {
      await importOpeningBalances({
        asOfDate: "2026-05-15",
        rows: [
          {
            sheetRow: 2,
            admissionNumber: adm("Asha"),
            dues: "2000",
            advance: "",
          },
        ],
      });
      const res = await checkFeeHistory({
        rows: [row("Asha", "Apr 2026"), row("Asha", "Jun 2026")],
      });
      expect("totals" in res && res.totals).toMatchObject({
        bills: 1,
        inOpeningBalance: 1,
      });
    });
  });

  describe("undo", () => {
    it("removes the bills, payments and advances", async () => {
      const { id } = await importRows([
        row("Asha", "Apr 2026", {
          paid: "1500",
          paidOn: "05/04/2026",
          receiptNo: "R-1",
        }),
      ]);

      expect(await undoFeeImport(id)).toEqual({ success: true });

      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(0);
      expect(
        await prisma.paymentTransaction.count({ where: { schoolId } }),
      ).toBe(0);
      expect(
        await prisma.advanceLedger.count({ where: { student: { schoolId } } }),
      ).toBe(0);
      const log = await prisma.activityLog.findFirst({
        where: { schoolId, action: "fee.history_import_undo" },
      });
      expect(log?.summary).toContain("1 bill for 1 student");
    });

    it("lets the file be imported again afterwards", async () => {
      const rows = [
        row("Asha", "Apr 2026", {
          paid: "1000",
          paidOn: "05/04/2026",
          receiptNo: "R-1",
        }),
      ];
      const { id } = await importRows(rows);
      await undoFeeImport(id);
      expect(await importRows(rows)).toMatchObject({ bills: 1 });
    });

    it("is refused once someone pays towards an imported bill", async () => {
      const { id } = await importRows([row("Asha", "Apr 2026")]);
      const dues = await billOrThrow(ids.Asha, "2026-04");
      await allocatePayment({
        studentId: ids.Asha,
        monthPayments: [{ chargeId: dues.id, amount: 500 }],
        method: "CASH",
      });

      expect(await undoFeeImport(id)).toEqual({
        error:
          "This import can't be undone: Asha already paid, had dues waived, or used their advance.",
      });
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(1);
    });

    it("is refused once an imported advance has been used", async () => {
      const { id } = await importRows([
        row("Asha", "Apr 2026", { paid: "1500", paidOn: "05/04/2026" }),
      ]);
      await generate("2026-05");

      expect(await undoFeeImport(id)).toHaveProperty("error");
    });

    it("clears an upload that stopped part-way, without logging it", async () => {
      const started = await startFeeHistoryImport({
        periods: ["2026-04"],
        heads: ["Tuition"],
      });
      if ("error" in started) throw new Error(started.error);
      await importFeeHistoryBatch({
        importId: started.id,
        rows: [row("Asha", "Apr 2026")],
      });

      const setup = await getFeeHistorySetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.imports[0].finished).toBe(false);

      expect(await undoFeeImport(started.id)).toEqual({ success: true });
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(0);
      expect(await prisma.activityLog.count({ where: { schoolId } })).toBe(0);
    });
  });
});
