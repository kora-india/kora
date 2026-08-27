import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { allocatePayment, waiveFeeChargeItem } from '../fee-allocator';
import { prisma } from '@schoolos/db';
import { auth } from '@schoolos/auth';

const schoolId = 'allocator-school-' + Math.random().toString(36).substring(7);

describe('Fee Allocator Actions', () => {
  let studentId: string;
  let chargeId: string;
  let chargeItemId: string;
  let componentId: string;
  let sessionId: string;
  let classId: string;
  let sectionId: string;

  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'test-user', schoolId, role: 'SUPER_ADMIN' }
    } as any);

    // Clean DB
    await prisma.school.deleteMany({ where: { id: schoolId } });

    // Create required initial data
    const school = await prisma.school.create({
      data: {
        id: schoolId,
        name: 'Test School',
        subdomain: 'testschool-' + Math.random().toString(36).substring(7),
      }
    });

    const acSession = await prisma.academicSession.create({
      data: {
        schoolId,
        name: '2024-25',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2025-03-31'),
        isCurrent: true,
      }
    });
    sessionId = acSession.id;

    const cls = await prisma.class.create({
      data: { schoolId, name: '10', grade: 10 }
    });
    classId = cls.id;

    const section = await prisma.section.create({
      data: { schoolId, classId, name: 'A' }
    });
    sectionId = section.id;

    const student = await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        rollNumber: '1',
        admissionNumber: 'ADM-001',
        name: 'Test Student',
        parentName: 'Parent',
        parentPhone: '9999999999',
      }
    });
    studentId = student.id;

    const component = await prisma.feeComponent.create({
      data: {
        schoolId,
        name: 'Tuition Fee',
        amount: 1000,
      }
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
        title: 'April Tuition',
        dueDate: new Date(),
        status: 'PENDING',
        items: {
          create: [
            {
              componentId,
              amount: 1000,
              paidAmount: 0,
              status: 'PENDING',
            }
          ]
        }
      },
      include: { items: true }
    });
    chargeId = charge.id;
    chargeItemId = charge.items[0].id;
  });

  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: schoolId } });
  });

  it('should allocate payment fully to a component and update charge to PAID', async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 1000 }],
      method: 'CASH'
    });

    expect((response as any).error).toBeUndefined();
    expect((response as any).success).toBe(true);
    expect((response as any).receiptNo).toBeDefined();

    const item = await prisma.feeChargeItem.findUnique({ where: { id: chargeItemId } });
    expect(item?.paidAmount.toNumber()).toBe(1000);
    expect(item?.status).toBe('PAID');

    const parentCharge = await prisma.feeCharge.findUnique({ where: { id: chargeId } });
    expect(parentCharge?.status).toBe('PAID');

    const paymentTx = await prisma.paymentTransaction.findUnique({ where: { receiptNo: (response as any).receiptNo } });
    expect(paymentTx?.amount.toNumber()).toBe(1000);
    expect(paymentTx?.status).toBe('SUCCESS');
  });

  it('should allocate partial payment and update charge to PARTIAL', async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 400 }],
      method: 'ONLINE'
    });

    expect((response as any).success).toBe(true);

    const item = await prisma.feeChargeItem.findUnique({ where: { id: chargeItemId } });
    expect(item?.paidAmount.toNumber()).toBe(400);
    expect(item?.status).toBe('PARTIAL');

    const parentCharge = await prisma.feeCharge.findUnique({ where: { id: chargeId } });
    expect(parentCharge?.status).toBe('PARTIAL');
  });

  it('should handle over-payment by creating an advance ledger', async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 1500 }],
      method: 'CASH'
    });

    expect((response as any).success).toBe(true);

    const item = await prisma.feeChargeItem.findUnique({ where: { id: chargeItemId } });
    expect(item?.paidAmount.toNumber()).toBe(1000);
    expect(item?.status).toBe('PAID');

    const advance = await prisma.advanceLedger.findFirst({
      where: { studentId, componentId }
    });
    expect(advance).toBeDefined();
    expect(advance?.amount.toNumber()).toBe(500);
  });

  it('should handle general advance creation', async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [],
      generalAdvanceAmount: 2000,
      method: 'CASH'
    });

    expect((response as any).success).toBe(true);

    const advance = await prisma.advanceLedger.findFirst({
      where: { studentId, componentId: null }
    });
    expect(advance).toBeDefined();
    expect(advance?.amount.toNumber()).toBe(2000);

    const item = await prisma.feeChargeItem.findUnique({ where: { id: chargeItemId } });
    expect(item?.paidAmount.toNumber()).toBe(0);
  });

  it('should reject payment with zero or negative amount', async () => {
    const response = await allocatePayment({
      studentId,
      componentPayments: [{ componentId, amount: 0 }],
      method: 'CASH'
    });
    expect(response.error).toBe('Payment amount must be greater than zero.');
  });

  it('should waive a fee charge item', async () => {
    const response = await waiveFeeChargeItem(chargeItemId);
    expect(response.success).toBe(true);

    const item = await prisma.feeChargeItem.findUnique({ where: { id: chargeItemId } });
    expect(item?.status).toBe('WAIVED');
  });
});
