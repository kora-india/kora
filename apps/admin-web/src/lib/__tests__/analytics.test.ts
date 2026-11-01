import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { getAnalyticsData } from "../reports/analytics";

const suffix = Math.random().toString(36).slice(2, 8);
const schoolId = `analytics-${suffix}`;
const TZ = "Asia/Kolkata";

const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };
const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };
const SESSION = { from: "2026-04-01", to: "2027-03-31" };

describe("analytics figures", () => {
  let class4: string;
  let class5: string;
  let section4a: string;
  let section4b: string;
  let asha: string;
  let kabir: string;
  let meera: string;
  let left: string;

  beforeAll(async () => {
    await prisma.school.create({
      data: { id: schoolId, name: "Numbers", subdomain: schoolId, plan: "PRO" },
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
    const newClass = async (name: string, grade: number) =>
      (await prisma.class.create({ data: { schoolId, name, grade } })).id;
    class4 = await newClass("Class 4", 4);
    class5 = await newClass("Class 5", 5);
    const newSection = async (classId: string, name: string) =>
      (await prisma.section.create({ data: { schoolId, classId, name } })).id;
    section4a = await newSection(class4, "A");
    section4b = await newSection(class4, "B");
    const section5a = await newSection(class5, "A");

    const student = async (
      name: string,
      classId: string,
      sectionId: string,
      over = {},
    ) =>
      (
        await prisma.student.create({
          data: {
            schoolId,
            classId,
            sectionId,
            name,
            rollNumber: name,
            admissionNumber: `${name}-${suffix}`,
            parentName: "Parent",
            parentPhone: "9999999999",
            ...over,
          },
        })
      ).id;
    asha = await student("Asha", class4, section4a, {
      createdAt: new Date("2026-10-05T06:00:00Z"),
    });
    kabir = await student("Kabir", class4, section4b, {
      createdAt: new Date("2026-04-05T06:00:00Z"),
    });
    meera = await student("Meera", class5, section5a, {
      createdAt: new Date("2026-04-05T06:00:00Z"),
    });
    left = await student("Left", class5, section5a, {
      isActive: false,
      createdAt: new Date("2026-04-05T06:00:00Z"),
    });

    const heads = await Promise.all(
      ["Tuition", "Transport"].map((name) =>
        prisma.feeComponent.create({
          data: { schoolId, name, amount: 0, frequency: "MONTHLY" },
        }),
      ),
    );
    const [tuition, transport] = heads;

    const pay = (
      studentId: string,
      amount: number,
      date: string,
      method: "CASH" | "UPI",
      status = "SUCCESS",
    ) =>
      prisma.paymentTransaction.create({
        data: {
          schoolId,
          studentId,
          amount,
          method,
          status,
          date: new Date(date),
          receiptNo: `R-${suffix}-${Math.random().toString(36).slice(2)}`,
        },
      });
    await pay(asha, 1000, "2026-10-05T06:00:00Z", "CASH");
    await pay(kabir, 500, "2026-10-20T06:00:00Z", "UPI");
    await pay(meera, 700, "2026-10-21T06:00:00Z", "UPI");
    await pay(meera, 800, "2026-09-10T06:00:00Z", "CASH");
    // Settling from an advance moves no new money.
    await pay(asha, 9999, "2026-10-06T06:00:00Z", "CASH", "ADJUSTMENT");
    await pay(meera, 123, "2026-07-31T10:00:00Z", "CASH");
    // 1 November in India, though still 31 October in UTC.
    await pay(meera, 300, "2026-10-31T19:00:00Z", "CASH");

    const bill = (
      studentId: string,
      dueDate: string,
      items: {
        componentId: string;
        amount: number;
        paidAmount?: number;
        status: "PAID" | "PARTIAL" | "OVERDUE" | "WAIVED" | "PENDING";
      }[],
    ) =>
      prisma.feeCharge.create({
        data: {
          schoolId,
          studentId,
          sessionId: session.id,
          title: dueDate,
          periodKey: dueDate.slice(0, 7),
          dueDate: new Date(dueDate),
          status: "OVERDUE",
          items: { create: items },
        },
      });
    await bill(asha, "2026-10-10", [
      {
        componentId: tuition.id,
        amount: 1000,
        paidAmount: 1000,
        status: "PAID",
      },
      { componentId: transport.id, amount: 400, status: "OVERDUE" },
    ]);
    await bill(kabir, "2026-10-10", [
      {
        componentId: tuition.id,
        amount: 1000,
        paidAmount: 500,
        status: "PARTIAL",
      },
      { componentId: transport.id, amount: 400, status: "WAIVED" },
    ]);
    await bill(meera, "2026-10-10", [
      {
        componentId: tuition.id,
        amount: 1000,
        paidAmount: 700,
        status: "PARTIAL",
      },
    ]);
    await bill(meera, "2026-09-10", [
      {
        componentId: tuition.id,
        amount: 1000,
        paidAmount: 800,
        status: "PARTIAL",
      },
    ]);
    // Someone who left owes nothing the school still chases.
    await bill(left, "2026-10-10", [
      { componentId: tuition.id, amount: 5000, status: "OVERDUE" },
    ]);

    const teacher = await prisma.user.create({
      data: {
        email: `t-${suffix}@test.com`,
        name: "Teacher",
        password: "hash",
        role: "TEACHER",
        schoolId,
      },
    });
    const mark = (
      studentId: string,
      classId: string,
      sectionId: string,
      date: string,
      status: "PRESENT" | "ABSENT",
    ) =>
      prisma.attendance.create({
        data: {
          schoolId,
          studentId,
          classId,
          sectionId,
          date: new Date(date),
          status,
          markedById: teacher.id,
        },
      });
    await mark(asha, class4, section4a, "2026-10-05", "PRESENT");
    await mark(kabir, class4, section4b, "2026-10-05", "ABSENT");
    await mark(meera, class5, section5a, "2026-10-05", "PRESENT");
    await mark(asha, class4, section4a, "2026-10-06", "PRESENT");
    // Well past the old 30-day limit.
    await mark(asha, class4, section4a, "2026-05-05", "ABSENT");
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { schoolId } });
    await prisma.paymentTransaction.deleteMany({ where: { schoolId } });
    await prisma.feeCharge.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await purgeSchool(prisma, schoolId);
  });

  describe("one period for everything", () => {
    it("totals only what falls inside it", async () => {
      const { metrics, paymentMethods } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
      });
      expect(metrics.totalRevenue).toBe(2200);
      expect(paymentMethods).toEqual([
        { method: "UPI", amount: 1200 },
        { method: "CASH", amount: 1000 },
      ]);
    });

    it("uses the school's own dates at the edges", async () => {
      const november = await getAnalyticsData(schoolId, TZ, {
        range: { from: "2026-11-01", to: "2026-11-30" },
      });
      expect(november.metrics.totalRevenue).toBe(300);
    });

    it("includes the period's first and last days", async () => {
      const total = async (from: string, to: string) =>
        (await getAnalyticsData(schoolId, TZ, { range: { from, to } })).metrics
          .totalRevenue;
      expect(await total("2026-07-31", "2026-07-31")).toBe(123);
      expect(await total("2026-07-01", "2026-07-31")).toBe(123);
      expect(await total("2026-07-01", "2026-07-30")).toBe(0);
      expect(await total("2026-08-01", "2026-08-31")).toBe(0);
    });

    it("bills, attendance and joiners follow the period too", async () => {
      const october = await getAnalyticsData(schoolId, TZ, { range: OCTOBER });
      expect(october.metrics).toMatchObject({
        totalBilled: 3400,
        totalPaid: 2200,
        feeCollectionRate: 64.7,
        avgAttendanceRate: 75,
        avgPresentPerDay: 2,
        newEnrolments: 1,
        activeStudentCount: 3,
      });

      const september = await getAnalyticsData(schoolId, TZ, {
        range: SEPTEMBER,
      });
      expect(september.metrics).toMatchObject({
        totalBilled: 1000,
        totalPaid: 800,
        feeCollectionRate: 80,
        avgAttendanceRate: 0,
        newEnrolments: 0,
      });
    });

    it("splits billing by fee head, without waived or left students", async () => {
      const { feeDistribution } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
      });
      expect(feeDistribution).toEqual([
        { name: "Tuition", value: 3000, percentage: 88 },
        { name: "Transport", value: 400, percentage: 12 },
      ]);
    });

    it("reads attendance back beyond the last 30 days", async () => {
      const { attendanceData, metrics } = await getAnalyticsData(schoolId, TZ, {
        range: SESSION,
      });
      expect(attendanceData.find((a) => a.month === "May")).toMatchObject({
        rate: 0,
        totalRecords: 1,
      });
      expect(metrics.avgAttendanceRate).toBe(60);
    });
  });

  describe("charts", () => {
    it("draws a session month by month", async () => {
      const { revenueData } = await getAnalyticsData(schoolId, TZ, {
        range: SESSION,
      });
      expect(revenueData[0].month).toBe("Apr");
      expect(revenueData.find((r) => r.month === "Sept")).toEqual({
        month: "Sept",
        collected: 800,
        pending: 200,
      });
      expect(revenueData.find((r) => r.month === "Oct")).toEqual({
        month: "Oct",
        collected: 2200,
        pending: 1200,
      });
    });

    it("draws a short period day by day", async () => {
      const { revenueData, attendanceData } = await getAnalyticsData(
        schoolId,
        TZ,
        { range: OCTOBER },
      );
      expect(revenueData).toHaveLength(31);
      expect(revenueData[4]).toEqual({
        month: "5 Oct",
        collected: 1000,
        pending: 0,
      });
      expect(revenueData[9]).toEqual({
        month: "10 Oct",
        collected: 0,
        pending: 1200,
      });
      expect(attendanceData[4]).toEqual({
        month: "5 Oct",
        rate: 67,
        totalRecords: 3,
      });
    });
  });

  describe("class and section", () => {
    it("narrows every figure to the class", async () => {
      const { metrics, paymentMethods, feeDistribution } =
        await getAnalyticsData(schoolId, TZ, {
          range: OCTOBER,
          classId: class4,
        });
      expect(metrics).toMatchObject({
        totalRevenue: 1500,
        totalBilled: 2400,
        totalPaid: 1500,
        avgAttendanceRate: 67,
        activeStudentCount: 2,
        newEnrolments: 1,
      });
      expect(paymentMethods).toHaveLength(2);
      expect(feeDistribution[0]).toMatchObject({
        name: "Tuition",
        value: 2000,
      });
    });

    it("narrows further to the section", async () => {
      const { metrics } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
        classId: class4,
        sectionId: section4b,
      });
      expect(metrics).toMatchObject({
        totalRevenue: 500,
        totalBilled: 1000,
        avgAttendanceRate: 0,
        activeStudentCount: 1,
      });
    });

    it("keeps another section's money out", async () => {
      const { metrics } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
        classId: class4,
        sectionId: section4a,
      });
      expect(metrics).toMatchObject({
        totalRevenue: 1000,
        totalBilled: 1400,
        avgAttendanceRate: 100,
      });
    });

    it("shows nothing for a class that isn't this school's", async () => {
      const { metrics } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
        classId: "another-school",
      });
      expect(metrics).toMatchObject({
        totalRevenue: 0,
        totalBilled: 0,
        activeStudentCount: 0,
      });
    });
  });

  describe("the comparison", () => {
    it("measures against the dates it's given", async () => {
      const { metrics } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
        previous: SEPTEMBER,
      });
      expect(metrics.revenueChangePct).toBe(175);
    });

    it("compares a class with that class", async () => {
      const { metrics } = await getAnalyticsData(schoolId, TZ, {
        range: OCTOBER,
        previous: SEPTEMBER,
        classId: class5,
      });
      expect(metrics.revenueChangePct).toBe(-12.5);
    });

    it("gives no percentage when there's nothing to compare with", async () => {
      const { metrics } = await getAnalyticsData(schoolId, TZ, {
        range: SEPTEMBER,
        previous: { from: "2026-08-01", to: "2026-08-31" },
      });
      expect(metrics.revenueChangePct).toBeNull();
    });
  });
});
