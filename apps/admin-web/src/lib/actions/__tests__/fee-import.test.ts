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
  checkOpeningBalances,
  getOpeningBalanceSetup,
  getOpeningBalanceTemplate,
  importOpeningBalances,
  undoOpeningBalanceImport,
} from "../fee-import";
import { allocatePayment, waiveFeeChargeItem } from "../fee-allocator";
import { enrollStudentTransport } from "../transport";
import { processClassFeeGeneration } from "@/lib/services/fee-generation-service";
import { GET as applyLateFees } from "@/app/api/cron/apply-late-fees/route";
import { getLedgerData } from "@/lib/reports/ledger";
import { DEFAULT_LEDGER_QUERY } from "@/lib/reports/ledger-query";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `import-fees-${run}`;
const otherSchoolId = `import-fees-other-${run}`;
const AS_OF = "2026-05-15";

let sessionId: string;
let classId: string;
let sectionId: string;
let annualId: string;
let admissionId: string;
const ids: Record<string, string> = {};
const adm = (name: string) => `OB-${name}-${run}`;

const signIn = (role = "SCHOOL_ADMIN", school = schoolId) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id: `user-${run}`, schoolId: school, role, name: "Asha Admin" },
  } as any);

const row = (sheetRow: number, name: string, dues = "", advance = "") => ({
  sheetRow,
  admissionNumber: adm(name),
  dues,
  advance,
});
/** Owes, Credit has an advance, Clear has neither. */
const fileRows = () => [
  row(2, "Owes", "4,500"),
  row(3, "Credit", "", "1000"),
  row(4, "Clear"),
];

const importFile = (extra: Record<string, unknown> = {}) =>
  importOpeningBalances({
    asOfDate: AS_OF,
    rows: fileRows(),
    fileName: "balances.xlsx",
    ...extra,
  });

async function importedId(extra: Record<string, unknown> = {}) {
  const res = await importFile(extra);
  if (!("success" in res)) throw new Error(res.error);
  return res.id;
}

async function generate(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return processClassFeeGeneration(schoolId, sessionId, classId, {
    periodKey,
    title: `${periodKey} Fees`,
    dueDate: new Date(Date.UTC(year, month - 1, 10)),
  });
}

/** The names of the fee heads on a student's bill for a month, or null. */
async function billedHeads(studentId: string, periodKey: string) {
  const charge = await prisma.feeCharge.findFirst({
    where: { studentId, periodKey },
    include: { items: { include: { component: true } } },
  });
  return charge ? charge.items.map((i) => i.component.name).sort() : null;
}

const openingBill = (studentId: string) =>
  prisma.feeCharge.findFirstOrThrow({
    where: { studentId, importId: { not: null } },
    include: { items: { include: { component: true } } },
  });

describe("opening balance import", () => {
  beforeAll(async () => {
    for (const [id, name] of [
      [schoolId, "main"],
      [otherSchoolId, "other"],
    ]) {
      await prisma.school.create({
        data: {
          id,
          name: `Import ${name}`,
          subdomain: `import-${name}-${run}`,
          timezone: "Asia/Kolkata",
          lateFeeEnabled: true,
          lateFeeAmount: 100,
        },
      });
    }
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

    const comp = (name: string, amount: number, frequency: any) =>
      prisma.feeComponent.create({
        data: { schoolId, name, amount, frequency },
      });
    const tuition = await comp("Tuition", 1000, "MONTHLY");
    const annual = await comp("Annual", 3000, "YEARLY");
    const admission = await comp("Admission", 5000, "ONE_TIME");
    annualId = annual.id;
    admissionId = admission.id;
    await prisma.feeStructure.create({
      data: {
        schoolId,
        sessionId,
        name: "Standard",
        status: "ACTIVE",
        items: {
          create: [tuition, annual, admission].map((c) => ({
            componentId: c.id,
          })),
        },
        classAssignments: { create: { classId } },
      },
    });

    for (const [i, name] of ["Owes", "Credit", "Clear"].entries()) {
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
    await prisma.advanceLedger.deleteMany({
      where: { student: { schoolId } },
    });
    await prisma.feeCharge.deleteMany({ where: { schoolId } });
    await prisma.feeImport.deleteMany({ where: { schoolId } });
    await prisma.activityLog.deleteMany({ where: { schoolId } });
    await prisma.studentTransport.deleteMany({ where: { schoolId } });
    await prisma.student.deleteMany({
      where: { schoolId, id: { notIn: Object.values(ids) } },
    });
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
    await purgeSchool(prisma, otherSchoolId);
  });

  describe("access", () => {
    it.each(["ACCOUNTANT", "TEACHER"])("is closed to a %s", async (role) => {
      signIn(role);
      for (const result of [
        await getOpeningBalanceSetup(),
        await getOpeningBalanceTemplate(),
        await checkOpeningBalances({ asOfDate: AS_OF, rows: fileRows() }),
        await importFile(),
        await undoOpeningBalanceImport("any"),
      ]) {
        expect(result).toHaveProperty("error");
      }
      expect(await prisma.feeImport.count({ where: { schoolId } })).toBe(0);
    });

    it("won't undo another school's import", async () => {
      const id = await importedId();
      signIn("SCHOOL_ADMIN", otherSchoolId);
      expect(await undoOpeningBalanceImport(id)).toEqual({
        error: "Import not found",
      });
    });
  });

  describe("setup and template", () => {
    it("lists the fee heads that may already be charged, never monthly ones", async () => {
      const setup = await getOpeningBalanceSetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.session?.id).toBe(sessionId);
      expect(setup.studentCount).toBe(3);
      expect(setup.feeHeads.map((h) => h.name)).toEqual([
        "Admission",
        "Annual",
      ]);
    });

    it("lists active students in roll order", async () => {
      await prisma.student.update({
        where: { id: ids.Clear },
        data: { isActive: false },
      });
      const template = await getOpeningBalanceTemplate();
      await prisma.student.update({
        where: { id: ids.Clear },
        data: { isActive: true },
      });
      if ("error" in template) throw new Error(template.error);
      expect(template.students).toEqual([
        {
          admissionNumber: adm("Owes"),
          name: "Owes",
          className: "Grade 5",
          section: "A",
          rollNumber: "1",
          parentName: "Parent",
        },
        expect.objectContaining({ name: "Credit", rollNumber: "2" }),
      ]);
    });
  });

  describe("check", () => {
    it("reports what importing would do, and saves nothing", async () => {
      await generate("2026-04");
      const res = await checkOpeningBalances({
        asOfDate: AS_OF,
        rows: fileRows(),
      });
      expect(res).toMatchObject({
        success: true,
        problems: [],
        students: 3,
        withDues: 1,
        withAdvance: 1,
        totalDues: 4500,
        totalAdvance: 1000,
        withExistingBills: 3,
      });
      expect(await prisma.feeImport.count({ where: { schoolId } })).toBe(0);
    });

    it("refuses a balance date in the future", async () => {
      const res = await checkOpeningBalances({
        asOfDate: "2999-01-01",
        rows: fileRows(),
      });
      expect(res).toEqual({ error: "The balance date can't be in the future" });
    });
  });

  describe("import", () => {
    it("bills dues as Previous Dues and credits advances", async () => {
      await importedId();

      const bill = await openingBill(ids.Owes);
      expect(bill).toMatchObject({
        title: "Previous Dues (as of 15 May 2026)",
        sessionId,
        status: "OVERDUE",
      });
      expect(bill.items).toHaveLength(1);
      expect(bill.items[0].component.name).toBe("Previous Dues");
      expect(Number(bill.items[0].amount)).toBe(4500);

      const credit = await prisma.advanceLedger.findFirstOrThrow({
        where: { studentId: ids.Credit },
      });
      expect(Number(credit.amount)).toBe(1000);
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(1);
      expect(
        await prisma.feeImportStudent.count({
          where: { student: { schoolId } },
        }),
      ).toBe(3);
    });

    it("records the import and logs it once", async () => {
      await importedId();
      const setup = await getOpeningBalanceSetup();
      if ("error" in setup) throw new Error(setup.error);
      expect(setup.imports).toEqual([
        expect.objectContaining({
          asOfDate: AS_OF,
          fileName: "balances.xlsx",
          studentCount: 3,
          totalDues: 4500,
          totalAdvance: 1000,
          createdByName: "Asha Admin",
          undoneAt: null,
        }),
      ]);
      const logs = await prisma.activityLog.findMany({ where: { schoolId } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "fee.opening_import",
        module: "fees",
      });
      expect(logs[0].summary).toContain("for 3 students as of 15 May 2026");
    });

    it("saves nothing from a file with a problem", async () => {
      const res = await importOpeningBalances({
        asOfDate: AS_OF,
        rows: [...fileRows(), row(5, "Nobody", "100")],
      });
      expect(res).toHaveProperty("error");
      expect(await prisma.feeImport.count({ where: { schoolId } })).toBe(0);
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(0);
    });

    it("won't import the same students twice", async () => {
      await importedId();
      const check = await checkOpeningBalances({
        asOfDate: AS_OF,
        rows: fileRows(),
      });
      expect(check).toMatchObject({ students: 0, alreadyImported: 3 });
      expect(await importFile()).toEqual({
        error: "These students already have opening balances",
      });
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(1);
    });

    it("shows in the ledger as dues, not as money collected", async () => {
      await importedId();
      const { metrics } = await getLedgerData(
        schoolId,
        DEFAULT_LEDGER_QUERY,
        "Asia/Kolkata",
      );
      expect(metrics.totalReceivables).toBe(4500);
      expect(metrics.totalInflow).toBe(0);
    });

    it("can be collected like any other bill", async () => {
      await importedId();
      const bill = await openingBill(ids.Owes);

      const paid = await allocatePayment({
        studentId: ids.Owes,
        monthPayments: [{ chargeId: bill.id, amount: 4500 }],
        method: "CASH",
      });

      expect(paid).toMatchObject({ success: true });
      expect((await openingBill(ids.Owes)).status).toBe("PAID");
    });
  });

  describe("fee generation afterwards", () => {
    it("doesn't bill the balance month or earlier, even for students who owed nothing", async () => {
      await importedId();
      await generate("2026-04");
      await generate("2026-05");
      for (const name of ["Owes", "Credit", "Clear"]) {
        expect(await billedHeads(ids[name], "2026-04")).toBeNull();
        expect(await billedHeads(ids[name], "2026-05")).toBeNull();
      }
    });

    it("bills from the next month", async () => {
      await importedId();
      await generate("2026-06");
      expect(await billedHeads(ids.Clear, "2026-06")).toEqual([
        "Admission",
        "Annual",
        "Tuition",
      ]);
    });

    it("skips fee heads the school said it already charged", async () => {
      await importedId({ chargedComponentIds: [annualId, admissionId] });
      await generate("2026-06");
      for (const name of ["Owes", "Credit", "Clear"]) {
        expect(await billedHeads(ids[name], "2026-06")).toEqual(["Tuition"]);
      }
    });

    it("bills a student who joined after the import as usual", async () => {
      await importedId();
      const joiner = await prisma.student.create({
        data: {
          schoolId,
          classId,
          sectionId,
          rollNumber: "9",
          admissionNumber: adm("Joiner"),
          name: "Joiner",
          parentName: "Parent",
          parentPhone: "9999999999",
        },
      });
      await generate("2026-05");
      expect(await billedHeads(joiner.id, "2026-05")).toContain("Tuition");
    });

    it("uses an opening advance on the next bill", async () => {
      await importedId({ chargedComponentIds: [annualId, admissionId] });
      await generate("2026-06");
      const balance = await prisma.advanceLedger.aggregate({
        where: { studentId: ids.Credit },
        _sum: { amount: true },
      });
      expect(Number(balance._sum.amount)).toBe(0);
    });
  });

  describe("bills that must stay as imported", () => {
    const runLateFees = () =>
      applyLateFees(
        new Request("https://app.test/api/cron/apply-late-fees", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

    it("gets no late fee, though ordinary overdue bills still do", async () => {
      await importedId({ chargedComponentIds: [annualId, admissionId] });
      await generate("2026-06");

      expect((await runLateFees()).status).toBe(200);

      expect((await openingBill(ids.Owes)).items).toHaveLength(1);
      expect(await billedHeads(ids.Owes, "2026-06")).toContain("Late Fee");
    });

    it("gets no transport fee", async () => {
      await importedId();
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
      signIn("SUPER_ADMIN"); // transport is a paid feature; this school is free

      const res = await enrollStudentTransport({
        studentId: ids.Owes,
        routeId: route.id,
        stopId: route.stops[0].id,
        distanceKm: 2,
        monthlyFee: 800,
      } as any);

      expect(res).toMatchObject({ success: true });
      expect((await openingBill(ids.Owes)).items).toHaveLength(1);
    });
  });

  describe("undo", () => {
    it("removes the import's bills and credits, and bills as usual again", async () => {
      const id = await importedId();

      expect(await undoOpeningBalanceImport(id)).toEqual({ success: true });

      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(0);
      expect(
        await prisma.advanceLedger.count({ where: { student: { schoolId } } }),
      ).toBe(0);
      expect(
        await prisma.feeImportStudent.count({
          where: { student: { schoolId } },
        }),
      ).toBe(0);
      const record = await prisma.feeImport.findUniqueOrThrow({
        where: { id },
      });
      expect(record.undoneAt).not.toBeNull();
      expect(record.undoneById).toBe(`user-${run}`);

      await generate("2026-05");
      expect(await billedHeads(ids.Clear, "2026-05")).toContain("Tuition");

      const log = await prisma.activityLog.findFirst({
        where: { schoolId, action: "fee.opening_import_undo" },
      });
      expect(log?.summary).toContain("as of 15 May 2026");
    });

    it("lets the corrected file be imported afterwards", async () => {
      const id = await importedId();
      await undoOpeningBalanceImport(id);
      expect(await importFile()).toMatchObject({ success: true });
    });

    it("can't be done twice", async () => {
      const id = await importedId();
      await undoOpeningBalanceImport(id);
      expect(await undoOpeningBalanceImport(id)).toEqual({
        error: "This import was already undone",
      });
    });

    it("is refused once a student has paid towards their dues", async () => {
      const id = await importedId();
      const bill = await openingBill(ids.Owes);
      await allocatePayment({
        studentId: ids.Owes,
        monthPayments: [{ chargeId: bill.id, amount: 500 }],
        method: "CASH",
      });

      expect(await undoOpeningBalanceImport(id)).toEqual({
        error:
          "This import can't be undone: Owes already paid, had dues waived, or used their advance.",
      });
      expect(await prisma.feeCharge.count({ where: { id: bill.id } })).toBe(1);
    });

    it("is refused once dues have been waived", async () => {
      const id = await importedId();
      const bill = await openingBill(ids.Owes);
      await waiveFeeChargeItem(bill.items[0].id, "Hardship case");

      expect(await undoOpeningBalanceImport(id)).toHaveProperty("error");
    });

    it("is refused once an opening advance has been used", async () => {
      const id = await importedId();
      await generate("2026-06");

      const res = await undoOpeningBalanceImport(id);

      expect(res).toHaveProperty("error");
      expect("error" in res && res.error).toContain("Credit");
      expect(
        await prisma.feeImport.count({ where: { id, undoneAt: null } }),
      ).toBe(1);
    });
  });
});
