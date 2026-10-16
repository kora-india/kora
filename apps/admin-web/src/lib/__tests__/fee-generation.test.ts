import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@schoolos/db";

// Next.js resolves "server-only" at build time; vitest can't.
vi.mock("server-only", () => ({}));

import { processClassFeeGeneration } from "../services/fee-generation-service";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `gen-school-${run}`;

let sessionId: string;
let classId: string;
let sectionId: string;
let studentA: string;
let studentB: string;

async function generate(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return processClassFeeGeneration(schoolId, sessionId, classId, {
    periodKey,
    title: `${periodKey} Fees`,
    dueDate: new Date(Date.UTC(year, month - 1, 10)),
  });
}

async function chargeTotal(studentId: string, periodKey: string) {
  const charge = await prisma.feeCharge.findFirst({
    where: { studentId, periodKey },
    include: { items: { include: { component: true } } },
  });
  if (!charge) return null;
  return {
    total: charge.items.reduce((s, i) => s + Number(i.amount), 0),
    components: charge.items.map((i) => i.component.name).sort(),
  };
}

async function addStudent(name: string) {
  const s = await prisma.student.create({
    data: {
      schoolId,
      classId,
      sectionId,
      rollNumber: `${name}-${run}`,
      admissionNumber: `GEN-${name}-${run}`,
      name,
      parentName: "Parent",
      parentPhone: "9999999999",
    },
  });
  return s.id;
}

describe("monthly fee generation", () => {
  beforeAll(async () => {
    await prisma.school.create({
      data: { id: schoolId, name: "Generator School", subdomain: `gen-${run}` },
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
      data: { schoolId, name: `Grade 5 ${run}`, grade: 5 },
    });
    classId = cls.id;
    const section = await prisma.section.create({
      data: { schoolId, classId, name: "A" },
    });
    sectionId = section.id;

    const comp = (
      name: string,
      amount: number,
      frequency: any,
      isActive = true,
    ) =>
      prisma.feeComponent.create({
        data: { schoolId, name, amount, frequency, isActive },
      });
    const components = await Promise.all([
      comp("Tuition", 1500, "MONTHLY"),
      comp("Admission", 5000, "ONE_TIME"),
      comp("Annual", 3000, "YEARLY"),
      comp("Exam", 600, "QUARTERLY"),
      comp("Lab", 400, "HALF_YEARLY"),
      comp("Retired", 999, "MONTHLY", false),
    ]);
    await prisma.feeStructure.create({
      data: {
        schoolId,
        sessionId,
        name: "Standard",
        status: "ACTIVE",
        items: { create: components.map((c) => ({ componentId: c.id })) },
        classAssignments: { create: { classId } },
      },
    });

    // A transport component with the casing older schools were seeded with.
    await prisma.feeComponent.create({
      data: {
        schoolId,
        name: "Transport Fee",
        category: "Transport",
        amount: 0,
        frequency: "MONTHLY",
        isOptional: true,
      },
    });

    studentA = await addStudent("A");
    studentB = await addStudent("B");

    const vehicle = await prisma.vehicle.create({
      data: {
        schoolId,
        registrationNo: `KA-${run}`,
        capacity: 30,
        driverName: "Driver",
        driverPhone: "9999999999",
      },
    });
    const route = await prisma.transportRoute.create({
      data: {
        schoolId,
        name: `Route ${run}`,
        startPoint: "Depot",
        endPoint: "School",
        vehicleId: vehicle.id,
        stops: { create: { stopName: "Stop 1", sequenceOrder: 1 } },
      },
      include: { stops: true },
    });
    await prisma.studentTransport.create({
      data: {
        schoolId,
        studentId: studentB,
        sessionId,
        routeId: route.id,
        stopId: route.stops[0].id,
        distanceKm: 4,
        monthlyFee: 800,
      },
    });
  });

  afterAll(async () => {
    await prisma.school.delete({ where: { id: schoolId } });
  });

  it("bills every due component in the session's first month, skipping inactive ones", async () => {
    const res = await generate("2026-04");
    expect(res.error).toBeUndefined();
    expect(res.generatedCount).toBe(2);

    expect(await chargeTotal(studentA, "2026-04")).toEqual({
      total: 1500 + 5000 + 3000 + 600 + 400,
      components: ["Admission", "Annual", "Exam", "Lab", "Tuition"],
    });
    // Transport is added with the existing "Transport" component, not a duplicate.
    expect((await chargeTotal(studentB, "2026-04"))?.total).toBe(10500 + 800);
    expect(
      await prisma.feeComponent.count({
        where: {
          schoolId,
          name: { equals: "Transport Fee", mode: "insensitive" },
        },
      }),
    ).toBe(1);
  });

  it("bills only the monthly fees in the next month", async () => {
    const res = await generate("2026-05");
    expect(res.generatedCount).toBe(2);
    expect(await chargeTotal(studentA, "2026-05")).toEqual({
      total: 1500,
      components: ["Tuition"],
    });
  });

  it("never bills the same month twice", async () => {
    const res = await generate("2026-05");
    expect(res.error).toBeUndefined();
    expect(res.generatedCount).toBe(0);
    expect(res.alreadyGenerated).toBe(2);
    expect(
      await prisma.feeCharge.count({
        where: { studentId: studentA, periodKey: "2026-05" },
      }),
    ).toBe(1);
  });

  it("bills the quarterly fee again in the next quarter", async () => {
    await generate("2026-07");
    expect(await chargeTotal(studentA, "2026-07")).toEqual({
      total: 1500 + 600,
      components: ["Exam", "Tuition"],
    });
  });

  it("bills a mid-year joiner for the periods they haven't been charged", async () => {
    const joiner = await addStudent("C");
    await generate("2026-08");
    // Admission (once), annual (once a session), the current quarter's exam
    // fee and the current half-year's lab fee, plus tuition.
    expect(await chargeTotal(joiner, "2026-08")).toEqual({
      total: 1500 + 5000 + 3000 + 600 + 400,
      components: ["Admission", "Annual", "Exam", "Lab", "Tuition"],
    });
    // Existing students already paid this quarter's exam fee in July.
    expect(await chargeTotal(studentA, "2026-08")).toEqual({
      total: 1500,
      components: ["Tuition"],
    });
  });

  it("treats a charge made before period keys existed as that month's charge", async () => {
    await prisma.feeCharge.create({
      data: {
        schoolId,
        studentId: studentA,
        sessionId,
        title: "September (manual)",
        dueDate: new Date("2026-09-05"),
      },
    });
    const res = await generate("2026-09");
    expect(res.alreadyGenerated).toBe(1);
    expect(
      await prisma.feeCharge.count({
        where: {
          studentId: studentA,
          dueDate: { gte: new Date("2026-09-01"), lt: new Date("2026-10-01") },
        },
      }),
    ).toBe(1);
  });

  it("refuses a month outside the session", async () => {
    const res = await generate("2027-05");
    expect(res.error).toMatch(/outside the 2026-27 session/);
  });

  it("applies a student's advance as an ADJUSTMENT, not new revenue", async () => {
    await prisma.advanceLedger.create({
      data: { studentId: studentA, amount: 500, description: "Prepaid" },
    });
    await generate("2026-10");

    const adjustment = await prisma.paymentTransaction.findFirst({
      where: { studentId: studentA, reference: { contains: "2026-10" } },
    });
    expect(adjustment?.status).toBe("ADJUSTMENT");
    expect(Number(adjustment?.amount)).toBe(500);
    expect(adjustment?.receiptNo).toMatch(/^ADJ-/);

    const balance = await prisma.advanceLedger.aggregate({
      where: { studentId: studentA },
      _sum: { amount: true },
    });
    expect(Number(balance._sum.amount)).toBe(0);
  });
});
