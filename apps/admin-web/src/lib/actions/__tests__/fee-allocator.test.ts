import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
  vi,
} from "vitest";
import {
  allocatePayment,
  getFeeReceiptDetails,
  waiveFeeChargeItem,
} from "../fee-allocator";
import { prisma, purgeSchool } from "@schoolos/db";
import { buildPaymentPayload, splitMonthTotal } from "@/lib/fees/payment-split";
import { auth } from "@schoolos/auth";

const schoolId = "allocator-school-" + Math.random().toString(36).substring(7);

describe("Fee Allocator Actions", () => {
  let studentId: string;
  let chargeId: string;
  let chargeItemId: string;
  let componentId: string;
  let sessionId: string;
  let classId: string;
  let sectionId: string;

  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "test-user", schoolId, role: "SUPER_ADMIN" },
    } as any);

    // Clean DB
    await purgeSchool(prisma, schoolId);

    // Create required initial data
    const school = await prisma.school.create({
      data: {
        id: schoolId,
        name: "Test School",
        subdomain: "testschool-" + Math.random().toString(36).substring(7),
        // The setup wizard stores this non-IANA value; receipts must still work.
        timezone: "Asia/Kolkata (IST)",
      },
    });

    const acSession = await prisma.academicSession.create({
      data: {
        schoolId,
        name: "2024-25",
        startDate: new Date("2024-04-01"),
        endDate: new Date("2025-03-31"),
        isCurrent: true,
      },
    });
    sessionId = acSession.id;

    const cls = await prisma.class.create({
      data: { schoolId, name: "10", grade: 10 },
    });
    classId = cls.id;

    const section = await prisma.section.create({
      data: { schoolId, classId, name: "A" },
    });
    sectionId = section.id;

    const student = await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        rollNumber: "1",
        admissionNumber: "ADM-001",
        name: "Test Student",
        parentName: "Parent",
        parentPhone: "9999999999",
      },
    });
    studentId = student.id;

    const component = await prisma.feeComponent.create({
      data: {
        schoolId,
        name: "Tuition Fee",
        amount: 1000,
      },
    });
    componentId = component.id;
  });

  beforeEach(async () => {
    // Reset transaction data
    await prisma.feeCharge.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.advanceLedger.deleteMany();

    const charge = await prisma.feeCharge.create({
      data: {
        schoolId,
        studentId,
        sessionId,
        title: "April Tuition",
        // In the future, so status checks don't depend on the time of day.
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "PENDING",
        items: {
          create: [
            {
              componentId,
              amount: 1000,
              paidAmount: 0,
              status: "PENDING",
            },
          ],
        },
      },
      include: { items: true },
    });
    chargeId = charge.id;
    chargeItemId = charge.items[0].id;
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  it("should allocate payment fully to a component and update charge to PAID", async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 1000 }],
      method: "CASH",
    });

    expect((response as any).error).toBeUndefined();
    expect((response as any).success).toBe(true);
    expect((response as any).receiptNo).toBeDefined();

    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.paidAmount.toNumber()).toBe(1000);
    expect(item?.status).toBe("PAID");

    const parentCharge = await prisma.feeCharge.findUnique({
      where: { id: chargeId },
    });
    expect(parentCharge?.status).toBe("PAID");

    const paymentTx = await prisma.paymentTransaction.findUnique({
      where: {
        schoolId_receiptNo: {
          schoolId,
          receiptNo: (response as any).receiptNo,
        },
      },
    });
    expect(paymentTx?.amount.toNumber()).toBe(1000);
    expect(paymentTx?.status).toBe("SUCCESS");
  });

  it("should allocate partial payment and update charge to PARTIAL", async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 400 }],
      method: "ONLINE",
    });

    expect((response as any).success).toBe(true);

    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.paidAmount.toNumber()).toBe(400);
    expect(item?.status).toBe("PARTIAL");

    const parentCharge = await prisma.feeCharge.findUnique({
      where: { id: chargeId },
    });
    expect(parentCharge?.status).toBe("PARTIAL");
  });

  it("should handle over-payment by creating an advance ledger", async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 1500 }],
      method: "CASH",
    });

    expect((response as any).success).toBe(true);

    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.paidAmount.toNumber()).toBe(1000);
    expect(item?.status).toBe("PAID");

    const advance = await prisma.advanceLedger.findFirst({
      where: { studentId, componentId },
    });
    expect(advance).toBeDefined();
    expect(advance?.amount.toNumber()).toBe(500);
  });

  it("should handle general advance creation", async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [],
      generalAdvanceAmount: 2000,
      method: "CASH",
    });

    expect((response as any).success).toBe(true);

    const advance = await prisma.advanceLedger.findFirst({
      where: { studentId, componentId: null },
    });
    expect(advance).toBeDefined();
    expect(advance?.amount.toNumber()).toBe(2000);

    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.paidAmount.toNumber()).toBe(0);
  });

  it("should reject payment with zero or negative amount", async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 0 }],
      method: "CASH",
    });
    expect(response.error).toBe("Payment amount must be greater than zero.");
  });

  it("should waive a fee charge item and record who and why", async () => {
    const response = await waiveFeeChargeItem(chargeItemId, "Scholarship");
    expect(response.success).toBe(true);

    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.status).toBe("WAIVED");
    expect(item?.waiverReason).toBe("Scholarship");
    expect(item?.waivedBy).toBe("test-user");

    const charge = await prisma.feeCharge.findUnique({
      where: { id: chargeId },
    });
    expect(charge?.status).toBe("WAIVED");
  });

  it("requires a waiver reason", async () => {
    const response = await waiveFeeChargeItem(chargeItemId, "  ");
    expect(response.error).toMatch(/reason/i);

    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.status).toBe("PENDING");
  });

  it("refuses to waive a fully paid item", async () => {
    await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 1000 }],
      method: "CASH",
    });
    const response = await waiveFeeChargeItem(chargeItemId, "Scholarship");
    expect(response.error).toMatch(/fully paid/i);
  });

  it("credits the paid part of a waived item to the student's advance", async () => {
    await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 300 }],
      method: "CASH",
    });
    const response = await waiveFeeChargeItem(chargeItemId, "Hardship");
    expect(response.success).toBe(true);

    const credit = await prisma.advanceLedger.findFirst({
      where: { studentId, componentId },
    });
    expect(credit?.amount.toNumber()).toBe(300);
  });

  it("numbers receipts sequentially per school", async () => {
    const first = await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 100 }],
      method: "CASH",
    });
    const second = await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 100 }],
      method: "CASH",
    });

    const seq = (receiptNo: string) => Number(receiptNo.split("-").pop());
    expect((first as any).receiptNo).toMatch(/^RCP-\d{4}-\d{5}$/);
    expect(seq((second as any).receiptNo)).toBe(
      seq((first as any).receiptNo) + 1,
    );
  });

  it("skips receipt numbers that are already taken", async () => {
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { nextReceiptNumber: true },
    });
    const year = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
    }).format(new Date());
    const takenNo = `RCP-${year}-${String(school.nextReceiptNumber).padStart(5, "0")}`;
    await prisma.paymentTransaction.create({
      data: {
        schoolId,
        studentId,
        amount: 1,
        receiptNo: takenNo,
      },
    });

    const response = await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 100 }],
      method: "CASH",
    });
    expect(response.error).toBeUndefined();
    expect((response as any).receiptNo).not.toBe(takenNo);
  });

  it("returns the original receipt when a payment is retried with the same key", async () => {
    const request = {
      studentId,
      monthPayments: [{ chargeId, amount: 500 }],
      method: "CASH" as const,
      idempotencyKey: "retry-key-" + Math.random().toString(36).slice(2),
    };
    const first = await allocatePayment(request);
    const retry = await allocatePayment(request);

    expect((retry as any).receiptNo).toBe((first as any).receiptNo);
    const payments = await prisma.paymentTransaction.count({
      where: { schoolId, idempotencyKey: request.idempotencyKey },
    });
    expect(payments).toBe(1);
    const item = await prisma.feeChargeItem.findUnique({
      where: { id: chargeItemId },
    });
    expect(item?.paidAmount.toNumber()).toBe(500);
  });

  it("reprints a receipt exactly as it was issued", async () => {
    const first = await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 400 }],
      method: "CASH",
    });
    expect((first as any).receiptData.remainingOutstanding).toBe(600);

    // A later payment clears the charge...
    await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 600 }],
      method: "CASH",
    });

    // ...but the first receipt still shows what was owed at the time.
    const reprint = await getFeeReceiptDetails((first as any).receiptNo);
    expect(reprint.success).toBe(true);
    expect(reprint.data?.remainingOutstanding).toBe(600);
    expect(reprint.data?.timestamp).toBeTruthy();
  });

  it("keeps a part-paid charge OVERDUE once its due date has passed", async () => {
    await prisma.feeCharge.update({
      where: { id: chargeId },
      data: { dueDate: new Date("2024-05-10"), status: "OVERDUE" },
    });
    await allocatePayment({
      studentId,
      monthPayments: [{ chargeId, amount: 200 }],
      method: "CASH",
    });
    const charge = await prisma.feeCharge.findUnique({
      where: { id: chargeId },
    });
    expect(charge?.status).toBe("OVERDUE");
  });

  it("rejects a charge that belongs to another student and records nothing", async () => {
    const other = await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        rollNumber: "2-" + Math.random().toString(36).slice(2, 6),
        admissionNumber: "ADM-" + Math.random().toString(36).slice(2, 8),
        name: "Other Student",
        parentName: "Parent",
        parentPhone: "9999999999",
      },
    });
    const response = await allocatePayment({
      studentId: other.id,
      monthPayments: [{ chargeId, amount: 100 }],
      method: "CASH",
    });
    expect(response.error).toMatch(/not found/i);
    expect(
      await prisma.paymentTransaction.count({ where: { studentId: other.id } }),
    ).toBe(0);
  });
  // P5: with the same charge or item twice, the batched update would apply
  // only one of the amounts while the receipt records both.
  it("rejects a payment that lists the same month twice", async () => {
    const response = await allocatePayment({
      studentId,
      monthPayments: [
        { chargeId, amount: 400 },
        { chargeId, amount: 300 },
      ],
      method: "CASH",
    });
    expect(response.error).toBe(
      "Each month can appear only once in a payment.",
    );
    expect(
      await prisma.paymentTransaction.count({ where: { studentId } }),
    ).toBe(0);
  });

  it("rejects a payment that lists the same fee item twice", async () => {
    const response = await allocatePayment({
      studentId,
      itemPayments: [
        { chargeItemId, amount: 400 },
        { chargeItemId, amount: 300 },
      ],
      method: "CASH",
    });
    expect(response.error).toBe(
      "Each fee item can appear only once in a payment.",
    );
    const item = await prisma.feeChargeItem.findUniqueOrThrow({
      where: { id: chargeItemId },
    });
    expect(Number(item.paidAmount)).toBe(0);
  });
  // U10: what the server records matches what the screens preview.
  describe("payment split", () => {
    async function twoItemCharge() {
      const transport = await prisma.feeComponent.create({
        data: { schoolId, name: `Transport ${Math.random()}`, amount: 500 },
      });
      const charge = await prisma.feeCharge.create({
        data: {
          schoolId,
          studentId,
          sessionId,
          title: "May Fees",
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          items: {
            create: [
              { componentId, amount: 1000 },
              { componentId: transport.id, amount: 500 },
            ],
          },
        },
        include: { items: { orderBy: { id: "asc" } } },
      });
      return charge;
    }

    it("fills a month total into its items in creation order", async () => {
      const charge = await twoItemCharge();
      await allocatePayment({
        studentId,
        monthPayments: [{ chargeId: charge.id, amount: 1200 }],
        method: "CASH",
      });
      const items = await prisma.feeChargeItem.findMany({
        where: { chargeId: charge.id },
        orderBy: { id: "asc" },
      });
      expect(items.map((i) => Number(i.paidAmount))).toEqual([1000, 200]);
      // The preview's split agrees.
      expect(
        splitMonthTotal(
          charge.items.map((i) => ({ id: i.id, due: Number(i.amount) })),
          1200,
        ).allocations.map((a) => a.amount),
      ).toEqual([1000, 200]);
    });

    it("records a chosen item split exactly", async () => {
      const charge = await twoItemCharge();
      const [, second] = charge.items;
      const payload = buildPaymentPayload(
        [
          {
            id: charge.id,
            items: charge.items.map((i) => ({
              id: i.id,
              due: Number(i.amount),
            })),
          },
        ],
        { [charge.id]: true },
        { [charge.id]: "500" },
        { [second.id]: "500" },
      );
      expect(payload.monthPayments).toEqual([]);
      const res = await allocatePayment({
        studentId,
        ...payload,
        method: "CASH",
      });
      expect(res.error).toBeUndefined();
      const paid = await prisma.feeChargeItem.findUniqueOrThrow({
        where: { id: second.id },
      });
      expect(Number(paid.paidAmount)).toBe(500);
    });

    it("applies the minimum partial payment to item amounts too", async () => {
      await prisma.school.update({
        where: { id: schoolId },
        data: { minPartialPaymentAmount: 800 },
      });
      try {
        const charge = await twoItemCharge();
        const res = await allocatePayment({
          studentId,
          itemPayments: [{ chargeItemId: charge.items[1].id, amount: 300 }],
          method: "CASH",
        });
        expect(res.error).toMatch(/minimum partial payment/i);
      } finally {
        await prisma.school.update({
          where: { id: schoolId },
          data: { minPartialPaymentAmount: 0 },
        });
      }
    });
  });
});
