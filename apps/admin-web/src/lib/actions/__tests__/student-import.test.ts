import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { bulkImportStudents } from '../student-import';
import { prisma } from '@schoolos/db';
import { auth } from '@schoolos/auth';

const schoolId = 'import-school-' + Math.random().toString(36).substring(7);

describe('Bulk Student Import', () => {
  let classId: string;
  let sectionId: string;

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
        subdomain: 'testschool-' + Math.random().toString(36).substring(7),
      }
    });

    const c = await prisma.class.create({
      data: {
        schoolId,
        name: 'Grade 10',
        grade: 10,
      }
    });
    classId = c.id;

    const s = await prisma.section.create({
      data: {
        schoolId,
        classId,
        name: 'A',
      }
    });
    sectionId = s.id;
  });

  beforeEach(async () => {
    await prisma.student.deleteMany();
  });

  afterAll(async () => {
    await prisma.school.deleteMany();
  });

  it('should successfully bulk import students', async () => {
    const data = [
      {
        name: 'John Doe',
        classId,
        sectionId,
        parentName: 'Mr. Doe',
        parentPhone: '1234567890',
        admissionNumber: 'ADM-001',
        rollNumber: '1',
      },
      {
        name: 'Jane Doe',
        classId,
        sectionId,
        parentName: 'Mrs. Doe',
        parentPhone: '0987654321',
        admissionNumber: 'ADM-002',
        rollNumber: '2',
      }
    ];

    const result = await bulkImportStudents(data);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);

    const students = await prisma.student.findMany({ where: { schoolId } });
    expect(students.length).toBe(2);
  });

  it('should auto-generate roll number and admission number if missing', async () => {
    const data = [
      {
        name: 'No Roll',
        classId,
        sectionId,
        parentName: 'Parent',
        parentPhone: '1234567890',
        // Missing admissionNumber and rollNumber
      }
    ];

    const result = await bulkImportStudents(data);
    expect(result.imported).toBe(1);

    const student = await prisma.student.findFirst({ where: { schoolId } });
    expect(student?.rollNumber).toBe('1');
    expect(student?.admissionNumber).toContain('ADM-');
  });

  it('should skip duplicate admission numbers', async () => {
    // Insert an existing student
    await prisma.student.create({
      data: {
        schoolId,
        classId,
        sectionId,
        name: 'Existing',
        parentName: 'Parent',
        parentPhone: '123',
        admissionNumber: 'ADM-DUPE',
        rollNumber: '99',
      }
    });

    const data = [
      {
        name: 'New Student',
        classId,
        sectionId,
        parentName: 'Parent',
        parentPhone: '1234567890',
        admissionNumber: 'ADM-DUPE', // Duplicate
        rollNumber: '100',
      },
      {
        name: 'Valid Student',
        classId,
        sectionId,
        parentName: 'Parent',
        parentPhone: '1234567890',
        admissionNumber: 'ADM-VALID',
        rollNumber: '101',
      }
    ];

    const result = await bulkImportStudents(data);
    
    // One imported, one skipped
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);

    const students = await prisma.student.findMany({ where: { schoolId } });
    expect(students.length).toBe(2); // The existing one + the valid one
  });
});
