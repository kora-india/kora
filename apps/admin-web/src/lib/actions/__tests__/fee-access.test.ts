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
  assignFeeStructureToClass,
  copyFeeStructures,
  createAcademicSession,
  createFeeComponent,
  createFeeStructure,
  saveFeeAutomationSettings,
  saveFeeCollectionPolicy,
  saveLateFeeSettings,
  setStudentFeeOverride,
  updateAcademicSession,
  updateFeeComponent,
  updateFeeStructure,
} from "../fee-settings";
import { generateMonthlyFees } from "../fee-generator";
import {
  allocatePayment,
  getStudentFeeDues,
  waiveFeeChargeItem,
} from "../fee-allocator";
import { deleteStudent } from "../students";
import {
  FULL_ACCESS,
  ROLE_DEFAULT_PERMISSIONS,
  UserRole,
} from "@schoolos/types";

const suffix = Math.random().toString(36).slice(2, 8);
const schoolId = `fee-access-${suffix}`;

const signInAs = (id: string, role: string) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId, role, name: "Tester" },
  } as any);

describe("who can do what with fees", () => {
  let accountantId: string;
  let trustedId: string;
  let sessionId: string;
  let classId: string;
  let componentId: string;
  let structureId: string;
  let studentId: string;
  let chargeId: string;
  let lateItemId: string;

  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Fee School",
        subdomain: schoolId,
        plan: "PRO",
      },
    });
    const user = (name: string, permissions?: object) =>
      prisma.user.create({
        data: {
          email: `${name}-${suffix}@test.com`,
          name,
          password: "hash",
          role: "ACCOUNTANT",
          schoolId,
          ...(permissions ? { permissions } : {}),
        },
      });
    accountantId = (await user("accountant")).id;
    // Every box the Edit access screen offers, ticked as high as it goes.
    trustedId = (await user("trusted", FULL_ACCESS)).id;

    sessionId = (
      await prisma.academicSession.create({
        data: {
          schoolId,
          name: "2026-27",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          isCurrent: true,
        },
      })
    ).id;
    classId = (
      await prisma.class.create({
        data: { schoolId, name: "Grade 5", grade: 5 },
      })
    ).id;
    const section = await prisma.section.create({
      data: { schoolId, classId, name: "A" },
    });
    const component = await prisma.feeComponent.create({
      data: { schoolId, name: "Tuition", amount: 1000, frequency: "MONTHLY" },
    });
    componentId = component.id;
    const late = await prisma.feeComponent.create({
      data: {
        schoolId,
        name: "Late Fee",
        amount: 0,
        frequency: "MONTHLY",
        category: "LATE_FEE",
      },
    });
    structureId = (
      await prisma.feeStructure.create({
        data: {
          schoolId,
          sessionId,
          name: "Standard",
          status: "ACTIVE",
          items: { create: { componentId } },
        },
      })
    ).id;
    studentId = (
      await prisma.student.create({
        data: {
          schoolId,
          classId,
          sectionId: section.id,
          rollNumber: "1",
          admissionNumber: `FA-${suffix}`,
          name: "Asha",
          parentName: "Parent",
          parentPhone: "9999999999",
        },
      })
    ).id;
    const charge = await prisma.feeCharge.create({
      data: {
        schoolId,
        studentId,
        sessionId,
        title: "April 2026",
        periodKey: "2026-04",
        dueDate: new Date("2026-04-10"),
        status: "OVERDUE",
        items: {
          create: [
            { componentId, amount: 1000, status: "OVERDUE" },
            { componentId: late.id, amount: 100, status: "OVERDUE" },
          ],
        },
      },
      include: { items: true },
    });
    chargeId = charge.id;
    lateItemId = charge.items.find((i) => i.componentId === late.id)!.id;
  });

  beforeEach(() => signInAs(accountantId, "ACCOUNTANT"));

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  const setupActions: [string, () => Promise<unknown>][] = [
    [
      "add a session",
      () =>
        createAcademicSession({
          name: "2027-28",
          startDate: "2027-04-01",
          endDate: "2028-03-31",
        } as any),
    ],
    [
      "change a session",
      () =>
        updateAcademicSession(sessionId, {
          name: "Changed",
          startDate: "2026-04-01",
          endDate: "2027-03-31",
        } as any),
    ],
    [
      "add a fee head",
      () =>
        createFeeComponent({
          name: "Sneaky",
          amount: 5,
          frequency: "MONTHLY",
        } as any),
    ],
    [
      "change a fee head",
      () =>
        updateFeeComponent(componentId, {
          name: "Tuition",
          amount: 1,
          frequency: "MONTHLY",
        } as any),
    ],
    [
      "add a fee plan",
      () =>
        createFeeStructure({
          name: "Sneaky",
          sessionId,
          items: [{ componentId, amount: 1 }],
        } as any),
    ],
    [
      "change a fee plan",
      () =>
        updateFeeStructure(structureId, {
          name: "Sneaky",
          sessionId,
          items: [{ componentId, amount: 1 }],
        } as any),
    ],
    [
      "assign a fee plan",
      () => assignFeeStructureToClass(classId, structureId),
    ],
    ["copy fee plans", () => copyFeeStructures({})],
    [
      "give a student a concession",
      () =>
        setStudentFeeOverride(studentId, sessionId, componentId, {
          isExempt: true,
        } as any),
    ],
    [
      "change the late fee",
      () => saveLateFeeSettings({ lateFeeEnabled: true } as any),
    ],
    [
      "change automatic billing",
      () => saveFeeAutomationSettings({ enabled: true } as any),
    ],
    ["change the collection policy", () => saveFeeCollectionPolicy({} as any)],
    [
      "generate fees",
      () =>
        generateMonthlyFees(
          sessionId,
          [classId],
          "May 2026",
          "2026-05-10",
          "2026-05",
        ),
    ],
    ["waive a late fee", () => waiveFeeChargeItem(lateItemId, "Being kind")],
  ];

  describe.each([
    ["an accountant", () => accountantId],
    ["an accountant given every permission", () => trustedId],
  ])("%s", (_, who) => {
    beforeEach(() => signInAs(who(), "ACCOUNTANT"));

    it.each(setupActions)("can't %s", async (_name, act) => {
      expect(await act()).toHaveProperty("error", "Unauthorized");
    });

    it("leaves fee setup exactly as it was", async () => {
      for (const [, act] of setupActions) await act();

      expect(await prisma.feeComponent.count({ where: { schoolId } })).toBe(2);
      expect(await prisma.feeStructure.count({ where: { schoolId } })).toBe(1);
      expect(await prisma.feeCharge.count({ where: { schoolId } })).toBe(1);
      expect(
        Number(
          (
            await prisma.feeComponent.findUniqueOrThrow({
              where: { id: componentId },
            })
          ).amount,
        ),
      ).toBe(1000);
      const late = await prisma.feeChargeItem.findUniqueOrThrow({
        where: { id: lateItemId },
      });
      expect(late.status).not.toBe("WAIVED");
    });
  });

  it("still lets an accountant see dues and take a payment", async () => {
    expect(ROLE_DEFAULT_PERMISSIONS[UserRole.ACCOUNTANT].fees).toBe("manage");

    const dues = await getStudentFeeDues(studentId);
    expect(dues).toMatchObject({ success: true });

    const paid = await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 500 }],
      method: "CASH",
    });
    expect(paid).toMatchObject({ success: true });
  });

  it("won't waive a student's dues as they're removed", async () => {
    signInAs(trustedId, "ACCOUNTANT");
    expect(await deleteStudent(studentId, { waiveOpenCharges: true })).toEqual({
      error: "Only a school admin can waive fees",
    });
    expect(
      (await prisma.student.findUniqueOrThrow({ where: { id: studentId } }))
        .isActive,
    ).toBe(true);
  });

  describe("a school admin", () => {
    beforeEach(() => signInAs("admin", "SCHOOL_ADMIN"));

    it("can change fee setup", async () => {
      const added = await createFeeComponent({
        name: "Library",
        amount: 50,
        frequency: "MONTHLY",
        isOptional: false,
      } as any);
      expect(added).not.toHaveProperty("error");
      expect(
        await prisma.feeComponent.count({
          where: { schoolId, name: "Library" },
        }),
      ).toBe(1);
      await prisma.feeComponent.deleteMany({
        where: { schoolId, name: "Library" },
      });
    });

    it("can waive a late fee", async () => {
      expect(
        await waiveFeeChargeItem(lateItemId, "Family hardship"),
      ).toMatchObject({ success: true });
    });
  });
});
