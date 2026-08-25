import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { saveLateFeeSettings } from '../fee-settings';
import { prisma } from '@schoolos/db';
import { auth } from '@schoolos/auth';

const schoolId = 'settings-school-' + Math.random().toString(36).substring(7);

describe('Fee Settings Actions', () => {
  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'test-user', schoolId, role: 'SUPER_ADMIN' }
    } as any);

    // Clean DB
    await prisma.school.deleteMany();

    // Create required initial data
    await prisma.school.create({
      data: {
        id: schoolId,
        name: 'Test School',
        subdomain: 'testschool2',
      }
    });
  });

  beforeEach(async () => {
    // Reset fee components
    await prisma.feeComponent.deleteMany();
    // Reset school late fee settings
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        lateFeeEnabled: false,
        lateFeeAmount: null,
        lateFeeFrequency: 'MONTHLY'
      }
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany();
  });

  it('should enable late fee, update school, and create Late Fee component if not exists', async () => {
    const response = await saveLateFeeSettings({
      lateFeeEnabled: true,
      lateFeeAmount: 500,
      lateFeeFrequency: 'MONTHLY'
    });

    expect(response.success).toBe(true);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    expect(school?.lateFeeEnabled).toBe(true);
    expect(school?.lateFeeAmount?.toNumber()).toBe(500);

    const component = await prisma.feeComponent.findFirst({
      where: { schoolId, category: 'LATE_FEE' }
    });
    expect(component).toBeDefined();
    expect(component?.name).toBe('Late Fee');
    expect(component?.amount.toNumber()).toBe(500);
  });

  it('should update existing Late Fee component amount when saving settings', async () => {
    // Manually create existing component
    await prisma.feeComponent.create({
      data: {
        schoolId,
        name: 'Late Fee',
        category: 'LATE_FEE',
        amount: 200,
      }
    });

    const response = await saveLateFeeSettings({
      lateFeeEnabled: true,
      lateFeeAmount: 750,
      lateFeeFrequency: 'MONTHLY'
    });

    expect(response.success).toBe(true);

    const component = await prisma.feeComponent.findFirst({
      where: { schoolId, category: 'LATE_FEE' }
    });
    // The amount should have updated to 750
    expect(component?.amount.toNumber()).toBe(750);
  });

  it('should disable late fee without creating component if lateFeeEnabled is false', async () => {
    const response = await saveLateFeeSettings({
      lateFeeEnabled: false,
      lateFeeAmount: 0,
      lateFeeFrequency: 'MONTHLY'
    });

    expect(response.success).toBe(true);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    expect(school?.lateFeeEnabled).toBe(false);

    const component = await prisma.feeComponent.findFirst({
      where: { schoolId, category: 'LATE_FEE' }
    });
    expect(component).toBeNull();
  });

  it('should create fee structure and invalidate feeStructures cache', async () => {
    const { invalidateCache } = await import('@/lib/redis');
    vi.mocked(invalidateCache).mockClear();

    const session = await prisma.academicSession.create({
      data: {
        schoolId,
        name: '2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      }
    });

    const comp = await prisma.feeComponent.create({
      data: {
        schoolId,
        name: 'Tuition',
        amount: 1500,
        frequency: 'MONTHLY',
        isOptional: false,
      }
    });

    const { createFeeStructure } = await import('../fee-settings');
    const response = await createFeeStructure({
      name: 'Primary Grade Structure',
      sessionId: session.id,
      components: [{ componentId: comp.id, amount: 1500 }]
    });

    expect(response.success).toBe(true);
    expect(invalidateCache).toHaveBeenCalledWith(`cache:${schoolId}:feeStructures:*`);

    const structure = await prisma.feeStructure.findFirst({
      where: { schoolId, name: 'Primary Grade Structure' },
      include: { items: true }
    });
    expect(structure).toBeDefined();
    expect(structure?.items.length).toBe(1);
  });
});
